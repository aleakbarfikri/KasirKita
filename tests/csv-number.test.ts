import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { legacyCsvNumber, parseCsvNumber } from "../lib/server/csv-number";
import { repairLegacyTransactionCosts } from "../lib/server/legacy-cost-repair";

test("Excel decimal commas are rounded as rupiah, not concatenated", () => {
  assert.equal(parseCsvNumber("2176,470588", 2, "harga_modal"), 2176);
  assert.equal(parseCsvNumber("1616,666667", 2, "harga_modal"), 1617);
  assert.equal(parseCsvNumber("812,5", 2, "harga_modal"), 813);
  assert.equal(parseCsvNumber("1.234,56", 2, "harga_modal"), 1235);
  assert.equal(parseCsvNumber("1,234.56", 2, "harga_modal"), 1235);
  assert.equal(parseCsvNumber("1.234", 2, "harga_modal"), 1234);
  assert.equal(legacyCsvNumber("2176,470588"), 2176470588);
  assert.throws(() => parseCsvNumber("1,2,3", 2, "harga_modal"), /Baris 2/);
});

test("reimport repairs only matching historical snapshots for that product", () => {
  const db = defaultDb();
  const original = 2176470588;
  db.transactionItems.push(
    { id: "bad", transactionId: "trx1", productId: "beng", sku: "9", name: "Beng-Beng", price: 3000, costPrice: original, quantity: 1, subtotal: 3000 },
    { id: "other-product", transactionId: "trx2", productId: "other", sku: "10", name: "Other", price: 3000, costPrice: original, quantity: 1, subtotal: 3000 },
    { id: "valid", transactionId: "trx3", productId: "beng", sku: "9", name: "Beng-Beng", price: 3000, costPrice: 2000, quantity: 1, subtotal: 3000 },
  );
  assert.equal(repairLegacyTransactionCosts(db, "beng", original, 2176), 1);
  assert.deepEqual(db.transactionItems.map((item) => item.costPrice), [2176, original, 2000]);
  assert.equal(repairLegacyTransactionCosts(db, "beng", original, 2176), 0);
});
