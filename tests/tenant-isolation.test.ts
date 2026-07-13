import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { applySuccessfulTransactionStock } from "../lib/server/inventory";
import { confirmQrisPayment, confirmSubscriptionPayment } from "../lib/server/payment-confirmation";

test("a shop cannot confirm another shop's QRIS transaction", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.transactions.push({ id: "trx_b", shopId: "shop_b", cashierId: "cashier_b", paymentMethod: "qris_pakasir", total: 25_000, status: "pending", externalRef: "shared-reference", createdAt: timestamp, updatedAt: timestamp });

  assert.throws(() => confirmQrisPayment(db, { reference: "shared-reference", cashierId: "cashier_b", adminId: "admin_a", shopId: "shop_a", actorRole: "admin", providerStatus: "paid" }), /not found/);
  assert.equal(db.transactions[0].status, "pending");
  assert.equal(db.balances.length, 0);
});

test("a shop cannot activate a subscription against a profile in another shop", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.adminProfiles.push({ userId: "admin_b", ownerId: "owner_b", shopId: "shop_b", isActive: true, planType: "pro", planStatus: "active", createdAt: timestamp, updatedAt: timestamp });
  db.subscriptionInvoices.push({ id: "invoice_b", ownerId: "owner_b", adminId: "admin_b", planType: "pro", billingPeriod: "monthly", amount: 49_000, provider: "pakasir", providerOrderId: "invoice_b", status: "pending", createdAt: timestamp, updatedAt: timestamp });

  assert.throws(() => confirmSubscriptionPayment(db, { invoiceId: "invoice_b", adminId: "admin_b", shopId: "shop_a", actorId: "admin_b", providerStatus: "paid" }), /Profil admin tidak ditemukan/);
  assert.equal(db.subscriptionInvoices[0].status, "pending");
});

test("stock mutation rejects a product that belongs to another shop", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.products.push({ id: "product_b", shopId: "shop_b", sku: "B-1", name: "Produk B", price: 10_000, costPrice: 5_000, stock: 5, isActive: true, createdAt: timestamp, updatedAt: timestamp });

  assert.throws(() => applySuccessfulTransactionStock(db, "shop_a", [{ productId: "product_b", quantity: 1, name: "Produk B" }]), /tidak ditemukan/);
  assert.equal(db.products[0].stock, 5);
});
