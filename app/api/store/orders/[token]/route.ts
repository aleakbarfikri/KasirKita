import { fail, ok } from "@/lib/server/http";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { confirmQrisPayment } from "@/lib/server/payment-confirmation";
import { paymentCredentials } from "@/lib/server/payment-secrets";
import { buildReceipt } from "@/lib/server/receipt";
import { sendOnlineOrderInvoiceEmail } from "@/lib/server/email";
import { now, readDb, withDbTransaction, type OnlineOrder, type Transaction } from "@/lib/server/data-store";

type Params = { params: Promise<{ token: string }> };

async function sendInvoiceIfNeeded(token: string, origin: string) {
  const db = await readDb();
  const order = db.onlineOrders.find((row) => row.publicToken === token && !row.invoiceEmailSentAt);
  if (!order || order.status === "pending_payment" || order.status === "payment_failed" || order.status === "cancelled") return;
  const transaction = db.transactions.find((row) => row.id === order.transactionId && row.status === "success");
  const shop = db.shops.find((row) => row.id === order.shopId);
  if (!transaction || !shop) return;
  const receipt = buildReceipt(db, transaction, origin);
  await sendOnlineOrderInvoiceEmail({
    to: order.customerEmail,
    customerName: order.customerName,
    shopName: shop.name,
    invoiceNumber: receipt.transaction.invoiceNumber,
    total: transaction.total,
    receiptUrl: receipt.publicUrl,
    items: receipt.items,
  });
  await withDbTransaction((current) => {
    const row = current.onlineOrders.find((item) => item.id === order.id && !item.invoiceEmailSentAt);
    if (row) { row.invoiceEmailSentAt = now(); row.updatedAt = now(); }
  });
}

export async function GET(request: Request, props: Params) {
  const { token } = await props.params;
  if (!/^ordpub_[a-f0-9]{32}$/.test(token)) return fail("Pesanan tidak ditemukan.", 404);
  const origin = new URL(request.url).origin;
  let db = await readDb();
  const initialOrder = db.onlineOrders.find((row) => row.publicToken === token);
  if (!initialOrder) return fail("Pesanan tidak ditemukan.", 404);
  let order: OnlineOrder = initialOrder;
  const initialTransaction = db.transactions.find((row) => row.id === order.transactionId);
  if (!initialTransaction) return fail("Transaksi pesanan tidak ditemukan.", 404);
  let transaction: Transaction = initialTransaction;

  if (order.status === "pending_payment" && transaction.status === "pending") {
    const profile = db.adminProfiles.find((row) => row.userId === order.adminId && row.shopId === order.shopId);
    const config = profile ? db.paymentConfigs.find((row) => row.ownerId === profile.ownerId) : null;
    const credentials = paymentCredentials(config);
    if (credentials.pakasirSlug && credentials.pakasirApiKey) {
      try {
        const provider = await getPakasirTransactionStatus({ slug: credentials.pakasirSlug, apiKey: credentials.pakasirApiKey, orderId: transaction.id, amount: transaction.total });
        if (provider.isPaid) {
          await withDbTransaction((current) => {
            const currentOrder = current.onlineOrders.find((row) => row.id === order.id);
            if (!currentOrder) throw Object.assign(new Error("Pesanan tidak ditemukan."), { status: 404 });
            const confirmed = confirmQrisPayment(current, { reference: transaction.externalRef!, cashierId: currentOrder.adminId, adminId: currentOrder.adminId, shopId: currentOrder.shopId, actorRole: "admin", providerStatus: provider.status });
            if (confirmed.transaction.status === "success" && currentOrder.status === "pending_payment") {
              currentOrder.status = "paid";
              currentOrder.paidAt = now();
              currentOrder.updatedAt = now();
            }
          });
          db = await readDb();
          const refreshedOrder = db.onlineOrders.find((row) => row.publicToken === token);
          if (refreshedOrder) order = refreshedOrder;
          const refreshedTransaction = db.transactions.find((row) => row.id === order.transactionId);
          if (refreshedTransaction) transaction = refreshedTransaction;
        } else if (order.expiredAt && new Date(order.expiredAt).getTime() <= Date.now()) {
          await withDbTransaction((current) => {
            const currentOrder = current.onlineOrders.find((row) => row.id === order.id && row.status === "pending_payment");
            const currentTransaction = current.transactions.find((row) => row.id === transaction.id && row.status === "pending");
            if (currentOrder) { currentOrder.status = "payment_failed"; currentOrder.updatedAt = now(); }
            if (currentTransaction) { currentTransaction.status = "failed"; currentTransaction.updatedAt = now(); }
          });
          db = await readDb();
          const refreshedOrder = db.onlineOrders.find((row) => row.publicToken === token);
          if (refreshedOrder) order = refreshedOrder;
          const refreshedTransaction = db.transactions.find((row) => row.id === order.transactionId);
          if (refreshedTransaction) transaction = refreshedTransaction;
        }
      } catch {
        // Provider may be temporarily unavailable; keep the order pending and retry on the next poll.
      }
    }
  }

  if (transaction.status === "success") {
    try { await sendInvoiceIfNeeded(token, origin); } catch { /* retry on a later poll */ }
    db = await readDb();
    const refreshedOrder = db.onlineOrders.find((row) => row.publicToken === token);
    if (refreshedOrder) order = refreshedOrder;
  }
  const shop = db.shops.find((row) => row.id === order.shopId);
  const items = db.transactionItems.filter((row) => row.transactionId === order.transactionId).map((row) => ({ name: row.name, quantity: row.quantity, price: row.price, subtotal: row.subtotal }));
  return ok({ order: { id: order.id, status: order.status, customerName: order.customerName, paymentUrl: order.paymentUrl, qrImageDataUrl: order.qrImageDataUrl, totalPayment: order.totalPayment, fee: order.fee, expiredAt: order.expiredAt, paidAt: order.paidAt, invoiceEmailSent: Boolean(order.invoiceEmailSentAt), createdAt: order.createdAt }, transaction: { total: transaction.total, status: transaction.status, receiptUrl: transaction.status === "success" ? buildReceipt(db, transaction, origin).publicUrl : null }, shop: shop ? { id: shop.id, name: shop.name, address: shop.address, phone: shop.phone } : null, items, fulfillment: "pickup" });
}
