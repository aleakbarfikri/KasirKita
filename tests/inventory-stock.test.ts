import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { importedStock } from "../lib/server/imported-stock";
import { applySuccessfulTransactionStock } from "../lib/server/inventory";

test("importing an old CSV preserves stock after sales unless stock opname is selected", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.products.push({ id: "coffee", shopId: "shop", sku: "K-1", name: "Kopi", price: 3_000, costPrice: 2_000, stock: 10, isActive: true, createdAt: timestamp, updatedAt: timestamp });

  applySuccessfulTransactionStock(db, "shop", [{ productId: "coffee", name: "Kopi", quantity: 3 }]);
  const product = db.products[0];
  assert.equal(product.stock, 7);
  product.stock = importedStock(product.stock, 10, false);
  assert.equal(product.stock, 7);
  product.stock = importedStock(product.stock, 6, true);
  assert.equal(product.stock, 6);
});

test("blank CSV stock cannot silently disable stock tracking", () => {
  assert.equal(importedStock(0, null, false), 0);
  assert.equal(importedStock(4, null, false), 4);
  assert.equal(importedStock(4, null, true), null);
});
