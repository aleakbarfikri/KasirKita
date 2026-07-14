import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { buildReceipt, isReceiptToken } from "../lib/server/receipt";

test("public receipt exposes only display fields and accepts strong token format", () => {
  const db = defaultDb();
  const createdAt = new Date().toISOString();
  db.shops.push({ id: "shop-secret", ownerId: "owner-secret", name: "Toko", createdAt, updatedAt: createdAt });
  db.users.push({ id: "cashier-secret", name: "Kasir", email: "cashier@example.com", username: "cashier", role: "cashier", passwordHash: "not-returned", createdAt, updatedAt: createdAt });
  const transaction = { id: "trx_abcdef1234567890", shopId: "shop-secret", cashierId: "cashier-secret", receiptToken: "rcpt_0123456789abcdef0123456789abcdef", paymentMethod: "cash" as const, subtotal: 10_000, discountAmount: 0, total: 10_000, paidAmount: 10_000, changeAmount: 0, status: "success" as const, externalRef: "provider-secret", idempotencyKey: "internal-key", createdAt, updatedAt: createdAt };
  db.transactions.push(transaction);
  db.transactionItems.push({ id: "item-secret", transactionId: transaction.id, productId: "product-secret", sku: "SECRET-SKU", name: "Produk", price: 10_000, quantity: 1, subtotal: 10_000 });
  const receipt = buildReceipt(db, transaction);
  const serialized = JSON.stringify(receipt);
  assert.equal(receipt.transaction.invoiceNumber, "TRX-ABCDEF12");
  for (const secret of ["shop-secret", "cashier-secret", "provider-secret", "internal-key", "product-secret", "SECRET-SKU", "not-returned"]) assert.equal(serialized.includes(secret), false);
  assert.equal(isReceiptToken(transaction.receiptToken), true);
  assert.equal(isReceiptToken("rcpt_guessable"), false);
});
