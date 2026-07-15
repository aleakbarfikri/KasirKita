import { fail, ok } from "@/lib/server/http";
import { buildReceipt } from "@/lib/server/receipt";
import { reconcileOnlineOrderPayment } from "@/lib/server/online-order-payment";
import { readDb } from "@/lib/server/data-store";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { PakasirIntegrityError } from "@/lib/server/pakasir";
import { reportServerError } from "@/lib/server/monitoring";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, props: Params) {
  const { token } = await props.params;
  if (!/^ordpub_[a-f0-9]{32}$/.test(token)) return fail("Pesanan tidak ditemukan.", 404);
  const requireShared = process.env.NODE_ENV === "production";
  const [tokenLimit, ipLimit] = await Promise.all([
    enforceRateLimit(request, "online-order-status-token", { limit: 40, windowMs: 60_000, requireShared }, token),
    enforceRateLimit(request, "online-order-status-ip", { limit: 120, windowMs: 60_000, requireShared }),
  ]);
  if (("unavailable" in tokenLimit && tokenLimit.unavailable) || ("unavailable" in ipLimit && ipLimit.unavailable)) return fail("Pemeriksaan pembayaran sementara tidak tersedia.", 503);
  if (!tokenLimit.allowed || !ipLimit.allowed) return fail("Terlalu banyak permintaan status. Coba lagi sebentar.", 429);
  const origin = new URL(request.url).origin;
  let db = await readDb();
  const initialOrder = db.onlineOrders.find((row) => row.publicToken === token);
  if (!initialOrder) return fail("Pesanan tidak ditemukan.", 404);
  try {
    await reconcileOnlineOrderPayment(initialOrder.id, origin);
  } catch (error) {
    if (error instanceof PakasirIntegrityError) reportServerError(error, { operation: "public_online_payment_reconciliation", orderId: initialOrder.id });
    // Provider or email may be temporarily unavailable; webhook/cron/the next poll will retry safely.
  }
  db = await readDb();
  const order = db.onlineOrders.find((row) => row.publicToken === token);
  if (!order) return fail("Pesanan tidak ditemukan.", 404);
  const transaction = db.transactions.find((row) => row.id === order.transactionId);
  if (!transaction) return fail("Transaksi pesanan tidak ditemukan.", 404);
  const shop = db.shops.find((row) => row.id === order.shopId);
  const items = db.transactionItems.filter((row) => row.transactionId === order.transactionId).map((row) => ({ name: row.name, quantity: row.quantity, price: row.price, subtotal: row.subtotal }));
  return ok({ order: { id: order.id, status: order.status, customerName: order.customerName, paymentUrl: order.paymentUrl, qrImageDataUrl: order.qrImageDataUrl, totalPayment: order.totalPayment, fee: order.fee, expiredAt: order.expiredAt, paidAt: order.paidAt, invoiceEmailSent: Boolean(order.invoiceEmailSentAt), createdAt: order.createdAt }, transaction: { total: transaction.total, status: transaction.status, receiptUrl: transaction.status === "success" ? buildReceipt(db, transaction, origin).publicUrl : null }, shop: shop ? { id: shop.id, name: shop.name, address: shop.address, phone: shop.phone } : null, items, fulfillment: "pickup" });
}
