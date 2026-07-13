import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb, hashPassword } from "../lib/server/data-store";
import { decryptBackup, encryptBackup, writeVerifiedOffsiteBackup, type BackupObjectStore } from "../lib/server/offsite-backup";

test("offsite backup is encrypted, verified after upload, and prunes expired objects", async () => {
  const db = defaultDb();
  const timestamp = "2026-07-13T12:00:00.000Z";
  db.users.push({ id: "owner_1", name: "Owner", email: "owner@example.test", username: "private_owner", role: "owner", passwordHash: hashPassword("strong-password"), createdAt: timestamp, updatedAt: timestamp });
  db.paymentConfigs.push({ id: "config_1", ownerId: "owner_1", pakasirApiKey: "very-secret-provider-key", createdAt: timestamp, updatedAt: timestamp });

  const bodies = new Map<string, string>();
  const objects = [
    { pathname: "kasirkita-backups/old.json.enc", uploadedAt: new Date("2026-05-01T00:00:00.000Z") },
  ];
  const deleted: string[] = [];
  const store: BackupObjectStore = {
    async put(pathname, body) {
      bodies.set(pathname, body);
      objects.push({ pathname, uploadedAt: new Date(timestamp) });
    },
    async get(pathname) {
      return bodies.get(pathname) ?? null;
    },
    async list() {
      return objects;
    },
    async delete(pathnames) {
      deleted.push(...pathnames);
    },
  };
  const key = Buffer.alloc(32, 7).toString("base64");
  const result = await writeVerifiedOffsiteBackup(db, { reason: "test", retentionDays: 30, key, createdAt: timestamp }, store);
  const stored = bodies.get(result.pathname)!;

  assert.equal(stored.includes("private_owner"), false);
  assert.equal(stored.includes("very-secret-provider-key"), false);
  assert.equal(result.recordCount, result.verifiedRecordCount);
  assert.deepEqual(deleted, ["kasirkita-backups/old.json.enc"]);

  const envelope = JSON.parse(stored);
  assert.equal(decryptBackup(envelope, key).users[0].username, "private_owner");
  assert.throws(() => decryptBackup(envelope, Buffer.alloc(32, 8).toString("base64")));
});

test("backup encryption rejects missing or weak keys", () => {
  assert.throws(() => encryptBackup(defaultDb(), { id: "backup_1", reason: "test", createdAt: new Date().toISOString(), key: "weak" }), /32 byte/);
});
