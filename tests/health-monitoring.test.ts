import assert from "node:assert/strict";
import test from "node:test";
import { checkApplicationHealth } from "../app/api/health/route";
import { buildServerErrorLog } from "../lib/server/monitoring";

test("health check reports database readiness without exposing tenant data", async () => {
  const healthy = await checkApplicationHealth(async () => ({ users: [{ username: "must-not-leak" }] }));
  assert.deepEqual(healthy, { ok: true, status: "healthy", checks: { database: "ok" } });
  assert.equal(JSON.stringify(healthy).includes("must-not-leak"), false);
});

test("health check returns a safe failure and emits a redacted production log", async () => {
  const originalConsoleError = console.error;
  const logs: string[] = [];
  console.error = (message?: unknown) => logs.push(String(message));
  try {
    const unhealthy = await checkApplicationHealth(async () => {
      throw new Error("database failed password=super-secret");
    });
    assert.deepEqual(unhealthy, { ok: false, status: "unhealthy", checks: { database: "unavailable" } });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes("super-secret"), false);
});

test("structured monitoring redacts credentials from error messages and context", () => {
  const log = buildServerErrorLog(new Error("request failed token=token-value"), {
    authorization: "Bearer bearer-value",
    nested: { apiKey: "provider-key", note: "password=plain-value" },
  });
  const serialized = JSON.stringify(log);
  assert.equal(serialized.includes("token-value"), false);
  assert.equal(serialized.includes("bearer-value"), false);
  assert.equal(serialized.includes("provider-key"), false);
  assert.equal(serialized.includes("plain-value"), false);
  assert.equal(serialized.includes("[REDACTED]"), true);
});
