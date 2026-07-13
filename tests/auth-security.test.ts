import assert from "node:assert/strict";
import test from "node:test";
import {
  createSignedSessionToken,
  defaultDb,
  sessionTokenHash,
  verifySignedSessionToken,
} from "../lib/server/data-store";

const bootstrapKeys = [
  "KASIRKITA_BOOTSTRAP_OWNER_USERNAME",
  "KASIRKITA_BOOTSTRAP_OWNER_EMAIL",
  "KASIRKITA_BOOTSTRAP_OWNER_PASSWORD",
  "KASIRKITA_BOOTSTRAP_OWNER_NAME",
  "KASIRKITA_BOOTSTRAP_OWNER_SHOP_NAME",
] as const;

function snapshotEnv(keys: readonly string[]) {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Map<string, string | undefined>) {
  snapshot.forEach((value, key) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
}

test("empty database has no hardcoded Owner", () => {
  const snapshot = snapshotEnv(bootstrapKeys);
  try {
    for (const key of bootstrapKeys) delete process.env[key];
    assert.equal(defaultDb().users.length, 0);
  } finally {
    restoreEnv(snapshot);
  }
});

test("Owner bootstrap requires complete, strong environment values", () => {
  const snapshot = snapshotEnv(bootstrapKeys);
  try {
    process.env.KASIRKITA_BOOTSTRAP_OWNER_USERNAME = "secure_owner";
    delete process.env.KASIRKITA_BOOTSTRAP_OWNER_EMAIL;
    delete process.env.KASIRKITA_BOOTSTRAP_OWNER_PASSWORD;
    assert.throws(() => defaultDb(), /membutuhkan username, email, dan password/);

    process.env.KASIRKITA_BOOTSTRAP_OWNER_EMAIL = "owner@example.test";
    process.env.KASIRKITA_BOOTSTRAP_OWNER_PASSWORD = "unique-password-at-least-12";
    const db = defaultDb();
    assert.equal(db.users.length, 1);
    assert.equal(db.users[0].role, "owner");
    assert.notEqual(db.users[0].passwordHash, process.env.KASIRKITA_BOOTSTRAP_OWNER_PASSWORD);
  } finally {
    restoreEnv(snapshot);
  }
});

test("production rejects a missing or placeholder auth secret", () => {
  const keys = ["NODE_ENV", "KASIRKITA_AUTH_SECRET", "NEXTAUTH_SECRET"];
  const snapshot = snapshotEnv(keys);
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXTAUTH_SECRET;
    process.env.KASIRKITA_AUTH_SECRET = "change-this-secret-minimum-32-characters";
    assert.throws(
      () => createSignedSessionToken("user_1", "sess_1", new Date(Date.now() + 60_000).toISOString()),
      /KASIRKITA_AUTH_SECRET wajib diisi/,
    );
  } finally {
    restoreEnv(snapshot);
  }
});

test("signed session binds the user, server-side session id, and expiry", () => {
  const keys = ["NODE_ENV", "KASIRKITA_AUTH_SECRET", "NEXTAUTH_SECRET"];
  const snapshot = snapshotEnv(keys);
  try {
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.KASIRKITA_AUTH_SECRET = "test-only-secret-with-more-than-32-characters";
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const token = createSignedSessionToken("user_1", "sess_1", expiresAt);
    assert.deepEqual(verifySignedSessionToken(token), { userId: "user_1", sessionId: "sess_1", expiresAt });
    assert.notEqual(sessionTokenHash(token), token);
  } finally {
    restoreEnv(snapshot);
  }
});
