import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb, type SubscriptionInvoice } from "../lib/server/data-store";
import { maintainSubscriptionInvoices, paymentDeadline } from "../lib/server/subscription-invoice-retention";

function invoice(id: string, status: SubscriptionInvoice["status"], ageMs: number): SubscriptionInvoice {
  const createdAt = new Date(Date.now() - ageMs).toISOString();
  return { id, ownerId: "owner", adminId: "admin", planType: "pro", billingPeriod: "monthly", amount: 49_000, provider: "pakasir", providerOrderId: id, status, createdAt, updatedAt: createdAt };
}

test("subscription payment deadline is capped at one hour", () => {
  const createdAt = "2026-07-14T10:00:00.000Z";
  assert.equal(paymentDeadline({ createdAt, expiredAt: null }), "2026-07-14T11:00:00.000Z");
  assert.equal(paymentDeadline({ createdAt, expiredAt: "2026-07-14T10:30:00.000Z" }), "2026-07-14T10:30:00.000Z");
  assert.equal(paymentDeadline({ createdAt, expiredAt: "2026-07-14T12:00:00.000Z" }), "2026-07-14T11:00:00.000Z");
});

test("unpaid invoices expire after one hour and disappear after one day while paid invoices remain", () => {
  const db = defaultDb();
  db.subscriptionInvoices.push(
    invoice("pending-new", "pending", 59 * 60 * 1000),
    invoice("pending-old", "pending", 61 * 60 * 1000),
    invoice("unpaid-day-old", "expired", 25 * 60 * 60 * 1000),
    invoice("paid-day-old", "paid", 30 * 24 * 60 * 60 * 1000),
  );
  const result = maintainSubscriptionInvoices(db);
  assert.deepEqual(result, { expired: 1, removed: 1 });
  assert.equal(db.subscriptionInvoices.find((row) => row.id === "pending-new")?.status, "pending");
  assert.equal(db.subscriptionInvoices.find((row) => row.id === "pending-old")?.status, "expired");
  assert.equal(db.subscriptionInvoices.some((row) => row.id === "unpaid-day-old"), false);
  assert.equal(db.subscriptionInvoices.some((row) => row.id === "paid-day-old"), true);
});
