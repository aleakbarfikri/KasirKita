import crypto from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import { normalizeRestoredDb, now, readDb, type AppDb } from "@/lib/server/data-store";

const BACKUP_PREFIX = "kasirkita-backups/";

export type EncryptedBackupEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  id: string;
  reason: string;
  createdAt: string;
  checksum: string;
  recordCount: number;
  iv: string;
  authTag: string;
  ciphertext: string;
};

export type BackupObject = {
  pathname: string;
  uploadedAt: Date;
};

export type BackupObjectStore = {
  put(pathname: string, body: string): Promise<void>;
  get(pathname: string): Promise<string | null>;
  list(prefix: string): Promise<BackupObject[]>;
  delete(pathnames: string[]): Promise<void>;
};

function encryptionKey(value = process.env.KASIRKITA_BACKUP_ENCRYPTION_KEY || "") {
  const trimmed = value.trim();
  const bytes = /^[a-f0-9]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  if (bytes.length !== 32) {
    throw new Error("KASIRKITA_BACKUP_ENCRYPTION_KEY wajib berupa 32 byte (base64 atau 64 karakter hex).");
  }
  return bytes;
}

function recordCount(db: AppDb) {
  return Object.values(db).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0);
}

export function encryptBackup(db: AppDb, input: { id: string; reason: string; createdAt: string; key?: string }): EncryptedBackupEnvelope {
  const plaintext = Buffer.from(JSON.stringify(db), "utf8");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(input.key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    id: input.id,
    reason: input.reason,
    createdAt: input.createdAt,
    checksum: crypto.createHash("sha256").update(plaintext).digest("hex"),
    recordCount: recordCount(db),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptBackup(envelope: EncryptedBackupEnvelope, key?: string) {
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") throw new Error("Format backup tidak didukung.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(key), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  const checksum = crypto.createHash("sha256").update(plaintext).digest("hex");
  if (checksum !== envelope.checksum) throw new Error("Checksum backup tidak cocok.");
  const db = normalizeRestoredDb(JSON.parse(plaintext.toString("utf8")));
  if (recordCount(db) !== envelope.recordCount) throw new Error("Jumlah record backup tidak cocok.");
  return db;
}

export function expiredBackupPaths(objects: BackupObject[], retentionDays: number, currentTime = Date.now()) {
  const cutoff = currentTime - retentionDays * 24 * 60 * 60 * 1000;
  return objects.filter((object) => object.uploadedAt.getTime() < cutoff).map((object) => object.pathname);
}

export async function writeVerifiedOffsiteBackup(
  db: AppDb,
  input: { reason: string; retentionDays: number; key?: string; createdAt?: string },
  store: BackupObjectStore,
) {
  const createdAt = input.createdAt || now();
  const id = `backup_${createdAt.replace(/[:.]/g, "-")}_${crypto.randomBytes(4).toString("hex")}`;
  const pathname = `${BACKUP_PREFIX}${id}.json.enc`;
  const envelope = encryptBackup(db, { id, reason: input.reason, createdAt, key: input.key });
  await store.put(pathname, JSON.stringify(envelope));

  const uploaded = await store.get(pathname);
  if (!uploaded) throw new Error("Backup tidak dapat dibaca kembali setelah upload.");
  const verified = decryptBackup(JSON.parse(uploaded) as EncryptedBackupEnvelope, input.key);

  const objects = await store.list(BACKUP_PREFIX);
  const expired = expiredBackupPaths(objects.filter((object) => object.pathname !== pathname), input.retentionDays);
  if (expired.length) await store.delete(expired);

  return {
    id,
    pathname,
    createdAt,
    reason: input.reason,
    recordCount: envelope.recordCount,
    verifiedRecordCount: recordCount(verified),
    checksum: envelope.checksum,
    deletedExpired: expired.length,
  };
}

function blobAuth() {
  const token = process.env.KASIRKITA_BACKUP_BLOB_READ_WRITE_TOKEN?.trim();
  const storeId = process.env.KASIRKITA_BACKUP_BLOB_STORE_ID?.trim();
  if (!token && !storeId) {
    throw new Error("Storage backup terpisah belum dikonfigurasi. Isi KASIRKITA_BACKUP_BLOB_STORE_ID atau token Blob khusus backup.");
  }
  return { ...(token ? { token } : {}), ...(storeId ? { storeId } : {}) };
}

function vercelBlobStore(): BackupObjectStore {
  const auth = blobAuth();
  return {
    async put(pathname, body) {
      await put(pathname, body, {
        ...auth,
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: "application/octet-stream",
        cacheControlMaxAge: 60,
      });
    },
    async get(pathname) {
      const result = await get(pathname, { ...auth, access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return new Response(result.stream).text();
    },
    async list(prefix) {
      const objects: BackupObject[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ ...auth, prefix, cursor, limit: 1000 });
        objects.push(...page.blobs.map((blob) => ({ pathname: blob.pathname, uploadedAt: blob.uploadedAt })));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return objects;
    },
    async delete(pathnames) {
      if (pathnames.length) await del(pathnames, auth);
    },
  };
}

export async function createOffsiteBackup(reason = "scheduled-daily") {
  const retentionValue = Number(process.env.KASIRKITA_BACKUP_RETENTION_DAYS || "30");
  const retentionDays = Number.isInteger(retentionValue) && retentionValue >= 7 && retentionValue <= 365 ? retentionValue : 30;
  const db = await readDb();
  return writeVerifiedOffsiteBackup(db, { reason, retentionDays }, vercelBlobStore());
}
