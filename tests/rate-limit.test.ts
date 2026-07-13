import assert from "node:assert/strict";
import test from "node:test";
import { enforceRateLimit } from "../lib/server/rate-limit";

test("blocks requests above the configured limit", async () => {
  const request = new Request("https://kasir-kita.test/api/auth", { headers: { "x-forwarded-for": "203.0.113.10" } });
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, true);
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, true);
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, false);
});
