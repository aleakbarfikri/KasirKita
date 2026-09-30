import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { repairCsvCosts } from "../lib/server/csv-cost-repair";

test("cost repair previews exact legacy matches and preserves stock and selling price", () => {
  const db = defaultDb();
  const timestamp = "2026-09-30T00:00:00.000Z";
  db.products.push({ id: "product-9", shopId: "shop-1", sku: "9", name: "Beng-Beng", price: 3000, costPrice: 2176470588, stock: 12, discountType: "none", discountValue: 0, isActive: true, createdAt: timestamp, updatedAt: timestamp });
  db.transactionItems.push({ id: "item-9", transactionId: "trx-1", productId: "product-9", sku: "9", name: "Beng-Beng", price: 3000, costPrice: 2176470588, quantity: 1, subtotal: 3000 });
  const rows = [{ sku: "9", costPrice: 2176, legacyCostPrice: 2176470588 }];

  assert.deepEqual(repairCsvCosts(db, "shop-1", rows, false), { matchedProducts: 1, correctedProducts: 1, repairedTransactionItems: 1, skippedProducts: 0, unmatchedRows: 0 });
  assert.equal(db.products[0].costPrice, 2176470588);
  assert.equal(db.transactionItems[0].costPrice, 2176470588);

  assert.deepEqual(repairCsvCosts(db, "shop-1", rows, true), { matchedProducts: 1, correctedProducts: 1, repairedTransactionItems: 1, skippedProducts: 0, unmatchedRows: 0 });
  assert.equal(db.products[0].costPrice, 2176);
  assert.equal(db.transactionItems[0].costPrice, 2176);
  assert.equal(db.products[0].stock, 12);
  assert.equal(db.products[0].price, 3000);
  assert.equal(db.products[0].discountValue, 0);
  assert.equal(repairCsvCosts(db, "shop-1", rows, true).repairedTransactionItems, 0);
});
