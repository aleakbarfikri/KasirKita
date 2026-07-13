import assert from "node:assert/strict";
import test from "node:test";
import { authClient } from "../lib/auth-client";
import { defaultDb, hashPassword } from "../lib/server/data-store";
import { createPendingMfaConfig, enableMfa, findEnabledMfaConfig } from "../lib/server/mfa";

test("login client preserves the server MFA challenge details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: { message: "Masukkan kode MFA untuk melanjutkan.", details: { mfaRequired: true, role: "admin" } } }), { status: 401, headers: { "Content-Type": "application/json" } });
  try {
    const result = await authClient.signIn.username({ username: "admin", password: "PasswordAdmin123" });
    assert.equal(result.error?.message, "Masukkan kode MFA untuk melanjutkan.");
    assert.deepEqual(result.error?.details, { mfaRequired: true, role: "admin" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("enabled MFA is detected for Owner and Admin but not Cashier", () => {
  process.env.KASIRKITA_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 12).toString("base64");
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  const users = [
    { id: "owner-mfa", role: "owner" as const },
    { id: "admin-mfa", role: "admin" as const },
    { id: "cashier-mfa", role: "cashier" as const },
  ];
  for (const user of users) {
    db.users.push({ ...user, name: user.role, email: `${user.role}@example.com`, username: user.role, passwordHash: hashPassword("PasswordAman123"), createdAt: timestamp, updatedAt: timestamp });
  }
  for (const userId of ["owner-mfa", "admin-mfa", "cashier-mfa"]) {
    const config = createPendingMfaConfig(userId, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", timestamp);
    enableMfa(config, [], timestamp);
    db.ownerMfaConfigs.push(config);
  }
  assert.equal(findEnabledMfaConfig(db, db.users.find((row) => row.id === "owner-mfa")!)?.ownerId, "owner-mfa");
  assert.equal(findEnabledMfaConfig(db, db.users.find((row) => row.id === "admin-mfa")!)?.ownerId, "admin-mfa");
  assert.equal(findEnabledMfaConfig(db, db.users.find((row) => row.id === "cashier-mfa")!), null);
});
