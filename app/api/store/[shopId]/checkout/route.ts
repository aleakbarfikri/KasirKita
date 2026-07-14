import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { createPakasirQris } from "@/lib/server/pakasir";
import { paymentCredentials } from "@/lib/server/payment-secrets";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { assertFeatureAllowed, assertMonthlyTransactionLimit } from "@/lib/server/subscription";
import { onlineOrderCheckoutSchema } from "@/lib/server/validators";
import { addAuditLog, isAdminProfileActive, now, withDbTransaction, type OnlineOrder, type Transaction, type TransactionItem } from "@/lib/server/data-store";
import { applySuccessfulTransactionStock } from "@/lib/server/inventory";
import { onlineOrderProductPrice } from "@/lib/server/online-orders";
import { findOnlineStore } from "@/lib/server/online-store";

type Params = { params: Promise<{ shopId: string }> };

export async function POST(request: Request, props: Params) {
  const { shopId: storeIdentifier } = await props.params;
  try {
    const body = onlineOrderCheckoutSchema.parse(await readJson(request));
    const limited = await enforceRateLimit(request, "online-order-checkout", { limit: 8, windowMs: 15 * 60_000 }, `${storeIdentifier}:${body.customerEmail}`);
    if (!limited.allowed) return fail("Terlalu banyak percobaan checkout. Coba lagi beberapa menit.", 429);
    const transactionId = createId("trx");
    const orderId = createId("ord");
    const publicToken = createId("ordpub");
    const receiptToken = createId("rcpt");
    const created = await withDbTransaction((db) => {
      const shop = findOnlineStore(db, storeIdentifier);
      const profile = shop ? db.adminProfiles.find((row) => row.shopId === shop.id) : null;
      if (!shop || shop.onlineStoreOpen === false || !profile || !isAdminProfileActive(profile)) throw Object.assign(new Error("Toko online sedang tutup atau tidak tersedia."), { status: 404 });
      const shopId = shop.id;
      assertFeatureAllowed(profile, "qrisPakasir");
      assertMonthlyTransactionLimit(db, profile);
      const config = db.paymentConfigs.find((row) => row.ownerId === profile.ownerId);
      const credentials = paymentCredentials(config);
      if (!credentials.pakasirSlug || !credentials.pakasirApiKey) throw Object.assign(new Error("Pembayaran QRIS KasirKita toko ini belum tersedia."), { status: 422 });
      const quantities = new Map<string, number>();
      body.items.forEach((item) => quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity));
      const items: TransactionItem[] = Array.from(quantities.entries()).map(([productId, quantity]) => {
        const product = db.products.find((row) => row.id === productId && row.shopId === shopId && row.isActive);
        if (!product) throw Object.assign(new Error("Salah satu produk tidak lagi tersedia."), { status: 422 });
        if (product.stock !== null && product.stock !== undefined && product.stock < quantity) throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi.`), { status: 422 });
        const price = onlineOrderProductPrice(product);
        return { id: createId("trxi"), transactionId, productId, sku: product.sku, name: product.name, originalPrice: product.price, price, costPrice: product.costPrice, discountAmount: Math.max(0, product.price - price), quantity, subtotal: price * quantity };
      });
      applySuccessfulTransactionStock(db, shopId, items, { validateOnly: true });
      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      if (total <= 0) throw Object.assign(new Error("Total pesanan tidak valid."), { status: 422 });
      const t = now();
      const transaction: Transaction = { id: transactionId, shopId, cashierId: profile.userId, paymentMethod: "qris_pakasir", subtotal: total, discountType: "none", discountValue: 0, discountAmount: 0, total, paidAmount: null, changeAmount: null, status: "pending", externalRef: transactionId, receiptToken, note: `Pesanan Online • ${body.customerName} • ${body.customerPhone}`, createdAt: t, updatedAt: t };
      const order: OnlineOrder = { id: orderId, publicToken, shopId, adminId: profile.userId, transactionId, customerName: body.customerName, customerEmail: body.customerEmail, customerPhone: body.customerPhone, status: "pending_payment", createdAt: t, updatedAt: t };
      db.transactions.push(transaction);
      db.transactionItems.push(...items);
      db.onlineOrders.push(order);
      addAuditLog(db, { actorId: profile.userId, actorRole: "admin", shopId, action: "create_online_order", entityType: "online_order", entityId: order.id, message: `Pesanan online baru dibuat oleh ${order.customerName} senilai ${total}.`, metadata: { transactionId, customerEmail: order.customerEmail, customerPhone: order.customerPhone, total } });
      return { order, transaction, items, shop, credentials };
    });
    try {
      const payment = await createPakasirQris({ slug: created.credentials.pakasirSlug!, apiKey: created.credentials.pakasirApiKey!, orderId: transactionId, amount: created.transaction.total });
      await withDbTransaction((db) => {
        const order = db.onlineOrders.find((row) => row.id === orderId);
        if (!order) return;
        order.paymentUrl = payment.paymentUrl;
        order.qrImageDataUrl = payment.qrImageDataUrl;
        order.totalPayment = payment.totalPayment;
        order.fee = payment.fee;
        order.expiredAt = payment.expiredAt ?? null;
        order.updatedAt = now();
      });
      return ok({ orderToken: publicToken, orderId, status: "pending_payment", total: created.transaction.total, shop: created.shop, payment: { ...payment, provider: "pakasir", pollEveryMs: 3000 } }, { status: 201 });
    } catch (error) {
      await withDbTransaction((db) => {
        const transaction = db.transactions.find((row) => row.id === transactionId);
        const order = db.onlineOrders.find((row) => row.id === orderId);
        if (transaction) { transaction.status = "failed"; transaction.updatedAt = now(); }
        if (order) { order.status = "payment_failed"; order.updatedAt = now(); }
      });
      return fail(error instanceof Error ? error.message : "Gagal membuat pembayaran QRIS.", 502);
    }
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 422;
    return fail(error instanceof Error ? error.message : "Data pesanan tidak valid.", status);
  }
}
