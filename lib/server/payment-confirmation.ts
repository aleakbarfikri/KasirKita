import { applySuccessfulTransactionStock } from "@/lib/server/inventory";
import { applyPaidSubscription } from "@/lib/server/subscription";
import { addAuditLog, incrementBalance, now, type AppDb, type UserRole } from "@/lib/server/data-store";

export function confirmQrisPayment(
  db: AppDb,
  input: {
    reference: string;
    cashierId: string;
    adminId: string;
    shopId: string;
    actorRole: Extract<UserRole, "admin" | "cashier">;
    providerStatus: string;
  },
) {
  const transaction = db.transactions.find((row) => row.externalRef === input.reference && row.cashierId === input.cashierId && row.shopId === input.shopId);
  if (!transaction) throw Object.assign(new Error("Payment reference not found"), { status: 404 });
  if (transaction.status === "success") return { applied: false, transaction };
  if (transaction.status !== "pending") return { applied: false, transaction };

  transaction.status = "success";
  transaction.updatedAt = now();
  const items = db.transactionItems.filter((item) => item.transactionId === transaction.id);
  applySuccessfulTransactionStock(db, transaction.shopId, items, { allowNegative: true, ignoreMissing: true });
  incrementBalance(db, input.adminId, "totalEarnedQrisApi", transaction.total);
  addAuditLog(db, {
    actorId: input.cashierId,
    actorRole: input.actorRole,
    shopId: input.shopId,
    action: "confirm_qris_pakasir",
    entityType: "transaction",
    entityId: transaction.id,
    message: `Pembayaran QRIS KasirKita dikonfirmasi sukses senilai ${transaction.total}.`,
    metadata: { providerStatus: input.providerStatus, total: transaction.total },
  });
  return { applied: true, transaction };
}

export function confirmSubscriptionPayment(
  db: AppDb,
  input: {
    invoiceId: string;
    adminId: string;
    shopId: string;
    actorId: string;
    providerStatus: string;
  },
) {
  const invoice = db.subscriptionInvoices.find((row) => row.id === input.invoiceId && row.adminId === input.adminId);
  if (!invoice) throw Object.assign(new Error("Invoice subscription tidak ditemukan."), { status: 404 });
  const profile = db.adminProfiles.find((row) => row.userId === input.adminId && row.shopId === input.shopId);
  if (!profile) throw Object.assign(new Error("Profil admin tidak ditemukan."), { status: 404 });
  if (invoice.status === "paid") return { applied: false, invoice, profile };
  if (invoice.status !== "pending") return { applied: false, invoice, profile };

  applyPaidSubscription(profile, invoice.planType, invoice.billingPeriod);
  invoice.status = "paid";
  invoice.paidAt = now();
  invoice.updatedAt = now();
  addAuditLog(db, {
    actorId: input.actorId,
    actorRole: "admin",
    shopId: input.shopId,
    action: "confirm_subscription_payment",
    entityType: "subscription_invoice",
    entityId: invoice.id,
    message: `Pembayaran subscription ${invoice.planType} sukses. Masa aktif diperpanjang sampai ${profile.activeUntil || "tanpa batas"}.`,
    metadata: {
      providerStatus: input.providerStatus,
      planType: invoice.planType,
      billingPeriod: invoice.billingPeriod,
      amount: invoice.amount,
      activeUntil: profile.activeUntil,
    },
  });
  return { applied: true, invoice, profile };
}
