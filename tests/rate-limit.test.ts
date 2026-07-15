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

test("security-sensitive limits fail closed when shared Redis is required but unavailable", async () => {
  const previous = {
    redis: process.env.REDIS_URL,
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  };
  delete process.env.REDIS_URL;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const request = new Request("https://kasir-kita.test/api/store/demo/checkout", { headers: { "x-forwarded-for": "203.0.113.50" } });
    const result = await enforceRateLimit(request, "test-checkout-shared", { limit: 2, windowMs: 60_000, requireShared: true });
    assert.equal(result.allowed, false);
    assert.equal("unavailable" in result && result.unavailable, true);
  } finally {
    if (previous.redis !== undefined) process.env.REDIS_URL = previous.redis;
    if (previous.kvUrl !== undefined) process.env.KV_REST_API_URL = previous.kvUrl;
    if (previous.kvToken !== undefined) process.env.KV_REST_API_TOKEN = previous.kvToken;
    if (previous.upstashUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = previous.upstashUrl;
    if (previous.upstashToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = previous.upstashToken;
  }
});
