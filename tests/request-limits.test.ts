import assert from "node:assert/strict";
import test from "node:test";
import { readLimitedJson } from "../lib/server/http";

test("limited JSON rejects oversized checkout bodies", async () => {
  const request = new Request("https://example.test/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "x".repeat(256) }) });
  await assert.rejects(() => readLimitedJson(request, 64), /Ukuran request terlalu besar/);
});

test("limited JSON rejects non-JSON checkout requests", async () => {
  const request = new Request("https://example.test/checkout", { method: "POST", headers: { "content-type": "text/plain" }, body: "hello" });
  await assert.rejects(() => readLimitedJson(request, 64), /Content-Type harus application\/json/);
});
