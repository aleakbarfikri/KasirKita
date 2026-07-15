import { sendOnlineOrderInvoiceEmail } from "@/lib/server/email";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { confirmQrisPayment } from "@/lib/server/payment-confirmation";
import { paymentCredentials } from "@/lib/server/payment-secrets";
import { buildReceipt } from "@/lib/server/receipt";
import { now, readDb, withDbTransaction } from "@/lib/server/data-store";
import { paymentDeadline } from "@/lib/server/subscription-invoice-retention";

const EMAIL_CLAIM_TIMEOUT_MS = 10 * 60_000;

export type OnlineOrderReconciliationResult = {
  orderId: string;
  status: "pending" | "paid" | "expired" | "already_final";
  providerStatus?: string;
};

export async function sendOnlineOrderInvoiceIfNeeded(orderId: string, origin: string) {
  const claimed = await withDbTransaction((db) => {
    const order = db.onlineOrders.find((row) => row.id === orderId);
    if (!order || order.invoiceEmailSentAt || order.status === "pending_payment" || order.status === "payment_failed" || order.status === "cancelled") return null;
    const transaction = db.transactions.find((row) => row.id === order.transactionId && row.status === "success");
    const shop = db.shops.find((row) => row.id === order.shopId);
    if (!transaction || !shop) return null;

    const claimedAt = order.invoiceEmailClaimedAt ? new Date(order.invoiceEmailClaimedAt).getTime() : 0;
    if (claimedAt && Date.now() - claimedAt < EMAIL_CLAIM_TIMEOUT_MS) return null;
    order.invoiceEmailClaimedAt = now();
    order.updatedAt = now();
    return { order: structuredClone(order), transaction: structuredClone(transaction), shop: structuredClone(shop), receipt: buildReceipt(db, transaction, origin) };
  });
  if (!claimed) return false;

  try {
    await sendOnlineOrderInvoiceEmail({
      to: claimed.order.customerEmail,
      customerName: claimed.order.customerName,
      shopName: claimed.shop.name,
      invoiceNumber: claimed.receipt.transaction.invoiceNumber,
      total: claimed.transaction.total,
      receiptUrl: claimed.receipt.publicUrl,
      items: claimed.receipt.items,
    });
    await withDbTransaction((db) => {
      const order = db.onlineOrders.find((row) => row.id === orderId && !row.invoiceEmailSentAt);
      if (order) {
        order.invoiceEmailSentAt = now();
        order.invoiceEmailClaimedAt = null;
        order.updatedAt = now();
      }
    });
    return true;
  } catch (error) {
    await withDbTransaction((db) => {
      const order = db.onlineOrders.find((row) => row.id === orderId && !row.invoiceEmailSentAt);
      if (order) order.invoiceEmailClaimedAt = null;
    });
    throw error;
  }
}

export async function reconcileOnlineOrderPayment(orderId: string, origin: string): Promise<OnlineOrderReconciliationResult> {
  const db = await readDb();
  const order = db.onlineOrders.find((row) => row.id === orderId);
  if (!order) throw Object.assign(new Error("Pesanan tidak ditemukan."), { status: 404 });
  const transaction = db.transactions.find((row) => row.id === order.transactionId);
  if (!transaction) throw Object.assign(new Error("Transaksi pesanan tidak ditemukan."), { status: 404 });

  if (transaction.status === "success") {
    await sendOnlineOrderInvoiceIfNeeded(order.id, origin);
    return { orderId, status: "already_final" };
  }
  if (order.status !== "pending_payment" || transaction.status !== "pending") return { orderId, status: "already_final" };

  const profile = db.adminProfiles.find((row) => row.userId === order.adminId && row.shopId === order.shopId);
  const config = profile ? db.paymentConfigs.find((row) => row.ownerId === profile.ownerId) : null;
  const credentials = paymentCredentials(config);
  if (!credentials.pakasirSlug || !credentials.pakasirApiKey) throw new Error("Konfigurasi Pakasir pesanan tidak tersedia.");

  const provider = await getPakasirTransactionStatus({
    slug: credentials.pakasirSlug,
    apiKey: credentials.pakasirApiKey,
    orderId: transaction.id,
    amount: transaction.total,
  });

  if (provider.isPaid) {
    await withDbTransaction((current) => {
      const currentOrder = current.onlineOrders.find((row) => row.id === order.id);
      if (!currentOrder) throw Object.assign(new Error("Pesanan tidak ditemukan."), { status: 404 });
      const confirmed = confirmQrisPayment(current, {
        reference: transaction.externalRef!,
        cashierId: currentOrder.adminId,
        adminId: currentOrder.adminId,
        shopId: currentOrder.shopId,
        actorRole: "admin",
        providerStatus: provider.status,
      });
      if (confirmed.transaction.status === "success" && currentOrder.status === "pending_payment") {
        currentOrder.status = "paid";
        currentOrder.paidAt = now();
        currentOrder.updatedAt = now();
      }
    });
    await sendOnlineOrderInvoiceIfNeeded(order.id, origin);
    return { orderId, status: "paid", providerStatus: provider.status };
  }

  const deadline = paymentDeadline({ createdAt: order.createdAt, expiredAt: order.expiredAt });
  if (new Date(deadline).getTime() <= Date.now()) {
    await withDbTransaction((current) => {
      const currentOrder = current.onlineOrders.find((row) => row.id === order.id && row.status === "pending_payment");
      const currentTransaction = current.transactions.find((row) => row.id === transaction.id && row.status === "pending");
      if (currentOrder) {
        currentOrder.status = "payment_failed";
        currentOrder.expiredAt = deadline;
        currentOrder.updatedAt = now();
      }
      if (currentTransaction) {
        currentTransaction.status = "failed";
        currentTransaction.updatedAt = now();
      }
    });
    return { orderId, status: "expired", providerStatus: provider.status };
  }

  return { orderId, status: "pending", providerStatus: provider.status };
}
