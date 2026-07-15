import assert from "node:assert/strict";
import test from "node:test";
import { verifyTurnstile } from "../lib/server/turnstile";

test("Turnstile validation requires success, expected action, and an allowed hostname", async () => {
  const previousSecret = process.env.TURNSTILE_SECRET_KEY;
  const previousHosts = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "kasir-kita.com,www.kasir-kita.com";
  const request = new Request("https://kasir-kita.com/api/store/demo/checkout", { headers: { "x-forwarded-for": "203.0.113.10" } });
  const validFetch = async () => new Response(JSON.stringify({ success: true, action: "store_checkout", hostname: "kasir-kita.com" }), { status: 200 });
  const wrongActionFetch = async () => new Response(JSON.stringify({ success: true, action: "login", hostname: "kasir-kita.com" }), { status: 200 });

  try {
    assert.equal(await verifyTurnstile(request, "valid-token", "store_checkout", validFetch as typeof fetch), true);
    await assert.rejects(() => verifyTurnstile(request, "valid-token", "store_checkout", wrongActionFetch as typeof fetch), /Verifikasi keamanan gagal/);
  } finally {
    if (previousSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previousSecret;
    if (previousHosts === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.TURNSTILE_ALLOWED_HOSTNAMES = previousHosts;
  }
});
