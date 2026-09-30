import assert from "node:assert/strict";
import test from "node:test";
import { bulkPriceTotal } from "../lib/bulk-pricing";
import { productSchema, updateProductSchema } from "../lib/server/validators";

const offers = [
  { quantity: 2, total: 5000 },
  { quantity: 3, total: 8000 },
  { quantity: 4, total: 10000 },
];

test("bulk prices match configured quantities and combine for larger orders", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, index) => bulkPriceTotal(3000, index + 1, offers)),
    [3000, 5000, 8000, 10000, 13000, 15000, 18000, 20000],
  );
  assert.equal(bulkPriceTotal(3000, 3), 9000);
  assert.equal(bulkPriceTotal(2000, 2, offers), 4000);
});

test("inventory accepts valid package prices and rejects duplicate quantities", () => {
  const product = { name: "Kopi", price: 3000, costPrice: 1500, bulkPrices: offers };
  assert.deepEqual(productSchema.parse(product).bulkPrices, offers);
  assert.deepEqual(updateProductSchema.parse({ bulkPrices: [] }).bulkPrices, []);
  assert.equal(productSchema.safeParse({ ...product, bulkPrices: [offers[0], offers[0]] }).success, false);
  assert.equal(productSchema.safeParse({ ...product, bulkPrices: [{ quantity: 1, total: 1000 }] }).success, false);
});
