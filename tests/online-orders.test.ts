import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { canTransitionOnlineOrder, isOnlineOrderVisible, onlineOrderNumber, onlineOrderProductPrice } from "../lib/server/online-orders";
import { buildReceipt } from "../lib/server/receipt";
import { findOnlineStore } from "../lib/server/online-store";

test("online order prices are derived from trusted product data", () => {
  assert.equal(onlineOrderProductPrice({ price: 20_000, discountType: "percent", discountValue: 10 }), 18_000);
  assert.equal(onlineOrderProductPrice({ price: 20_000, discountType: "amount", discountValue: 3_000 }), 17_000);
  assert.equal(onlineOrderProductPrice({ price: 20_000, discountType: "percent", discountValue: 500 }), 0);
});

test("online order status follows paid, processing, ready, completed sequence", () => {
  assert.equal(canTransitionOnlineOrder("paid", "processing"), true);
  assert.equal(canTransitionOnlineOrder("processing", "ready"), true);
  assert.equal(canTransitionOnlineOrder("ready", "completed"), true);
  assert.equal(canTransitionOnlineOrder("paid", "completed"), false);
  assert.equal(canTransitionOnlineOrder("pending_payment", "processing"), false);
});

test("online store resolves a unique custom link while preserving the legacy shop id", () => {
  const db = defaultDb();
  const createdAt = new Date().toISOString();
  db.shops.push({ id: "shop_legacy", ownerId: "owner_1", name: "Kopi Kita", onlineStoreSlug: "kopi-kita", onlineStoreOpen: true, createdAt, updatedAt: createdAt });
  assert.equal(findOnlineStore(db, "kopi-kita")?.id, "shop_legacy");
  assert.equal(findOnlineStore(db, "shop_legacy")?.id, "shop_legacy");
  assert.equal(findOnlineStore(db, "toko-lain"), undefined);
});

test("finished online orders leave the dashboard after 24 hours while active orders stay visible", () => {
  const now = Date.parse("2026-07-15T07:00:00.000Z");
  assert.equal(isOnlineOrderVisible("completed", "2026-07-14T06:59:59.000Z", now), false);
  assert.equal(isOnlineOrderVisible("completed", "2026-07-15T06:00:00.000Z", now), true);
  assert.equal(isOnlineOrderVisible("processing", "2026-07-01T00:00:00.000Z", now), true);
});

test("online orders receive a readable stable reference", () => {
  assert.equal(onlineOrderNumber("ord_1234567890abcdef", "2026-07-15T01:00:00.000Z"), "ONL-20260715-90ABCDEF");
});

test("online order receipt includes pickup identity but not customer email", () => {
  const db = defaultDb();
  const createdAt = new Date().toISOString();
  db.shops.push({ id: "shop_1", ownerId: "owner_1", name: "Toko Uji", createdAt, updatedAt: createdAt });
  db.transactions.push({ id: "trx_1", shopId: "shop_1", cashierId: "admin_1", paymentMethod: "qris_pakasir", total: 25_000, status: "success", receiptToken: "rcpt_123", createdAt, updatedAt: createdAt });
  db.onlineOrders.push({ id: "ord_1", publicToken: "ordpub_1", shopId: "shop_1", adminId: "admin_1", transactionId: "trx_1", customerName: "Ayu", customerEmail: "ayu@example.com", customerPhone: "08123456789", status: "paid", createdAt, updatedAt: createdAt });
  const receipt = buildReceipt(db, db.transactions[0], "https://example.test");
  assert.equal(receipt.onlineOrder?.label, "Pesanan Online");
  assert.equal(receipt.onlineOrder?.customerName, "Ayu");
  assert.equal(receipt.onlineOrder?.customerPhone, "08123456789");
  assert.match(receipt.onlineOrder?.orderNumber || "", /^ONL-\d{8}-[A-Z0-9]{8}$/);
  assert.equal(JSON.stringify(receipt).includes("ayu@example.com"), false);
  db.onlineOrders[0].status = "processing";
  assert.equal(buildReceipt(db, db.transactions[0], "https://example.test").onlineOrder?.status, "processing");
});
