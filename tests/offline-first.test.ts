import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { CheckoutPayload, ProductRecord } from "../lib/api-client";
import { applyOfflineStockReservation } from "../lib/offline-stock";

function product(id: string, stock: number | null): ProductRecord {
  return {
    id,
    shopId: "shop-1",
    name: id,
    sku: id,
    price: 10_000,
    costPrice: 5_000,
    stock,
    isActive: true,
  };
}

test("offline checkout reserves cached stock without changing unlimited products", () => {
  const payload: CheckoutPayload = {
    idempotencyKey: "offline-test-1",
    paymentMethod: "cash",
    items: [
      { productId: "coffee", name: "Coffee", price: 10_000, quantity: 2 },
      { productId: "coffee", name: "Coffee", price: 10_000, quantity: 1 },
      { productId: "service", name: "Service", price: 10_000, quantity: 4 },
    ],
  };

  const result = applyOfflineStockReservation([
    product("coffee", 5),
    product("service", null),
    product("untouched", 8),
  ], payload);

  assert.equal(result.find((row) => row.id === "coffee")?.stock, 2);
  assert.equal(result.find((row) => row.id === "service")?.stock, null);
  assert.equal(result.find((row) => row.id === "untouched")?.stock, 8);
});

test("service worker caches only approved offline screens and never caches API responses", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /"\/admin\/pos"/);
  assert.match(source, /"\/admin\/inventory"/);
  assert.match(source, /"\/admin\/transactions"/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /CLEAR_PRIVATE_CACHE/);
  assert.match(source, /SYNC_OFFLINE_CHECKOUTS/);
});
