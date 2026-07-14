import type { AppDb, SubscriptionInvoice } from "@/lib/server/data-store";

export const SUBSCRIPTION_PAYMENT_WINDOW_MS = 60 * 60 * 1000;
export const UNPAID_INVOICE_RETENTION_MS = 24 * 60 * 60 * 1000;

export function paymentDeadline(invoice: Pick<SubscriptionInvoice, "createdAt" | "expiredAt">) {
  const localDeadline = new Date(invoice.createdAt).getTime() + SUBSCRIPTION_PAYMENT_WINDOW_MS;
  const providerDeadline = invoice.expiredAt ? new Date(invoice.expiredAt).getTime() : Number.POSITIVE_INFINITY;
  return new Date(Math.min(localDeadline, Number.isFinite(providerDeadline) ? providerDeadline : localDeadline)).toISOString();
}

export function maintainSubscriptionInvoices(db: AppDb, at = new Date()) {
  const nowMs = at.getTime();
  let expired = 0;
  let removed = 0;

  for (const invoice of db.subscriptionInvoices) {
    if (invoice.status !== "pending") continue;
    const deadline = paymentDeadline(invoice);
    invoice.expiredAt = deadline;
    if (new Date(deadline).getTime() <= nowMs) {
      invoice.status = "expired";
      invoice.updatedAt = at.toISOString();
      expired += 1;
    }
  }

  db.subscriptionInvoices = db.subscriptionInvoices.filter((invoice) => {
    if (invoice.status === "paid") return true;
    const keep = nowMs - new Date(invoice.createdAt).getTime() < UNPAID_INVOICE_RETENTION_MS;
    if (!keep) removed += 1;
    return keep;
  });

  return { expired, removed };
}

export function isSubscriptionInvoiceExpired(invoice: SubscriptionInvoice, at = new Date()) {
  return invoice.status !== "paid" && new Date(paymentDeadline(invoice)).getTime() <= at.getTime();
}
