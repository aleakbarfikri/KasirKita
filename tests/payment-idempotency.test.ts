import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { confirmQrisPayment, confirmSubscriptionPayment } from "../lib/server/payment-confirmation";

test("QRIS confirmation changes stock and balance exactly once", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.products.push({ id: "product_1", shopId: "shop_1", sku: "SKU-1", name: "Produk", price: 10_000, costPrice: 4_000, stock: 10, isActive: true, createdAt: timestamp, updatedAt: timestamp });
  db.transactions.push({ id: "trx_1", shopId: "shop_1", cashierId: "cashier_1", paymentMethod: "qris_pakasir", total: 20_000, status: "pending", externalRef: "trx_1", createdAt: timestamp, updatedAt: timestamp });
  db.transactionItems.push({ id: "item_1", transactionId: "trx_1", productId: "product_1", sku: "SKU-1", name: "Produk", price: 10_000, quantity: 2, subtotal: 20_000 });

  const input = { reference: "trx_1", cashierId: "cashier_1", adminId: "admin_1", shopId: "shop_1", actorRole: "cashier" as const, providerStatus: "paid" };
  assert.equal(confirmQrisPayment(db, input).applied, true);
  assert.equal(confirmQrisPayment(db, input).applied, false);
  assert.equal(db.products[0].stock, 8);
  assert.equal(db.balances[0].totalEarnedQrisApi, 20_000);
  assert.equal(db.auditLogs.filter((row) => row.action === "confirm_qris_pakasir").length, 1);
  assert.equal(db.financialLedgerEntries.filter((row) => row.journalKey === "sale:trx_1").length, 1);
});

test("subscription confirmation extends active period exactly once", () => {
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.adminProfiles.push({ userId: "admin_1", ownerId: "owner_1", shopId: "shop_1", isActive: true, activeUntil: "2026-08-13", planType: "pro", planStatus: "active", createdAt: timestamp, updatedAt: timestamp });
  db.subscriptionInvoices.push({ id: "invoice_1", ownerId: "owner_1", adminId: "admin_1", planType: "pro", billingPeriod: "monthly", amount: 49_000, provider: "pakasir", providerOrderId: "invoice_1", status: "pending", createdAt: timestamp, updatedAt: timestamp });

  const input = { invoiceId: "invoice_1", adminId: "admin_1", shopId: "shop_1", actorId: "admin_1", providerStatus: "paid" };
  const first = confirmSubscriptionPayment(db, input);
  const activeUntil = first.profile.activeUntil;
  assert.equal(first.applied, true);
  assert.equal(confirmSubscriptionPayment(db, input).applied, false);
  assert.equal(db.adminProfiles[0].activeUntil, activeUntil);
  assert.equal(db.auditLogs.filter((row) => row.action === "confirm_subscription_payment").length, 1);
  assert.equal(db.financialLedgerEntries.filter((row) => row.journalKey === "subscription:invoice_1").length, 1);
});
