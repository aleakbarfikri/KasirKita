import assert from "node:assert/strict";
import test from "node:test";
import { enforceRateLimit } from "../lib/server/rate-limit";

test("blocks requests above the configured limit", async () => {
  const request = new Request("https://kasir-kita.test/api/auth", { headers: { "x-forwarded-for": "203.0.113.10" } });
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, true);
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, true);
  assert.equal((await enforceRateLimit(request, "test-login", { limit: 2, windowMs: 60_000 })).allowed, false);
});

test("account limit cannot be bypassed by rotating IP addresses", async () => {
  const subject = `owner-${Date.now()}`;
  for (let index = 0; index < 2; index += 1) {
    const request = new Request("https://kasir-kita.test/api/auth", { headers: { "x-forwarded-for": `203.0.113.${index + 20}` } });
    assert.equal((await enforceRateLimit(request, "test-account", { limit: 2, windowMs: 60_000 }, subject)).allowed, true);
  }
  const rotatedIp = new Request("https://kasir-kita.test/api/auth", { headers: { "x-forwarded-for": "198.51.100.99" } });
  assert.equal((await enforceRateLimit(rotatedIp, "test-account", { limit: 2, windowMs: 60_000 }, subject)).allowed, false);
});
