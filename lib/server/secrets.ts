import crypto from "node:crypto";

const ENCRYPTED_PREFIX = "enc:v1";

function dataEncryptionKey(value = process.env.KASIRKITA_DATA_ENCRYPTION_KEY || "") {
  const trimmed = value.trim();
  const bytes = /^[a-f0-9]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  if (bytes.length !== 32) {
    throw new Error("KASIRKITA_DATA_ENCRYPTION_KEY wajib berupa 32 byte (base64 atau 64 karakter hex).");
  }
  return bytes;
}

export function isEncryptedSecret(value?: string | null) {
  return Boolean(value?.startsWith(`${ENCRYPTED_PREFIX}:`));
}

export function encryptSecret(value?: string | null, key?: string) {
  const plaintext = String(value || "").trim();
  if (!plaintext) return null;
  if (isEncryptedSecret(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataEncryptionKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [ENCRYPTED_PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptSecret(value?: string | null, key?: string) {
  const stored = String(value || "").trim();
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) return stored;
  const [prefix, version, iv, authTag, ciphertext] = stored.split(":");
  if (`${prefix}:${version}` !== ENCRYPTED_PREFIX || !iv || !authTag || !ciphertext) throw new Error("Format secret terenkripsi tidak valid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dataEncryptionKey(key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function maskSecret(value?: string | null) {
  const plaintext = String(value || "");
  if (!plaintext) return null;
  const visible = plaintext.slice(-4);
  return `${"•".repeat(Math.max(8, Math.min(16, plaintext.length - visible.length)))}${visible}`;
}

export function hashOneTimeRecoveryCode(code: string, key?: string) {
  return crypto.createHmac("sha256", dataEncryptionKey(key)).update(code.replace(/\s+/g, "").toUpperCase()).digest("hex");
}
