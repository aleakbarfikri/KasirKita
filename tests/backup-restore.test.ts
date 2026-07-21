import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kasirkita-restore-test-"));
process.env.KASIRKITA_DATA_DIR = dataDir;
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.REDIS_URL;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

let dataStore: typeof import("../lib/server/data-store");

test.before(async () => {
  dataStore = await import("../lib/server/data-store");
});

test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test("restore validates data, preserves a safety backup, and records an audit", async () => {
  const timestamp = "2026-07-13T12:00:00.000Z";
  const before = dataStore.defaultDb();
  before.users.push({ id: "owner_before", name: "Owner Before", email: "before@example.test", username: "owner_before", role: "owner", passwordHash: dataStore.hashPassword("safe-password-before"), createdAt: timestamp, updatedAt: timestamp });
  await dataStore.writeDb(before);

  const restored = dataStore.defaultDb();
  restored.users.push({ id: "owner_after", name: "Owner After", email: "after@example.test", username: "owner_after", role: "owner", passwordHash: dataStore.hashPassword("safe-password-after"), createdAt: timestamp, updatedAt: timestamp });
  restored.shops.push({ id: "shop_after", ownerId: "owner_after", name: "Toko Pulih", createdAt: timestamp, updatedAt: timestamp });

  const result = await dataStore.restoreBackupData(restored, { actorId: "owner_after", actorRole: "owner" });
  const active = await dataStore.readDb();
  const safetyBackup = await dataStore.readBackup(result.backupBeforeRestore.id);

  assert.equal(active.users.some((user) => user.id === "owner_after"), true);
  assert.equal(active.shops[0]?.name, "Toko Pulih");
  assert.equal(active.auditLogs.some((log) => log.action === "restore_backup"), true);
  assert.equal(safetyBackup?.data.users.some((user) => user.id === "owner_before"), true);
});

test("restore rejects malformed data and a backup without an Owner", () => {
  assert.throws(() => dataStore.normalizeRestoredDb({}), /users tidak ditemukan/);
  const withoutOwner = dataStore.defaultDb();
  assert.throws(() => dataStore.normalizeRestoredDb(withoutOwner), /tidak memiliki akun Owner/);
});

test("legacy backup without the additive financial ledger remains restorable", () => {
  const legacy = dataStore.defaultDb() as Partial<ReturnType<typeof dataStore.defaultDb>>;
  legacy.users!.push({ id: "legacy_owner", name: "Legacy Owner", email: "legacy@example.test", username: "legacy_owner", role: "owner", passwordHash: dataStore.hashPassword("legacy-safe-password"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  delete legacy.financialLedgerEntries;
  const restored = dataStore.normalizeRestoredDb(legacy);
  assert.deepEqual(restored.financialLedgerEntries, []);
});
