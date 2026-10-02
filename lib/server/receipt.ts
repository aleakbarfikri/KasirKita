import type { AppDb, Transaction } from "@/lib/server/data-store";
import { onlineOrderNumber } from "@/lib/server/online-orders";

export const RECEIPT_TOKEN_PATTERN = /^rcpt_[a-f0-9]{32}$/;

export function isReceiptToken(value: string) {
  return RECEIPT_TOKEN_PATTERN.test(value);
}

function invoiceNumber(id: string) {
  const shortId = id.replace(/^trx_/i, "").slice(0, 8).toUpperCase();
  return shortId ? `TRX-${shortId}` : "-";
}

export function receiptPublicUrl(token: string | null | undefined, origin?: string | null) {
  if (!token) return undefined;
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "";
  return base ? `${base.replace(/\/$/, "")}/r/${token}` : `/r/${token}`;
}

export function receiptPdfUrl(token: string | null | undefined, origin?: string | null) {
  if (!token) return undefined;
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "";
  return `${base.replace(/\/$/, "")}/api/receipts/${token}/pdf`;
}

export function buildReceipt(db: AppDb, transaction: Transaction, origin?: string | null) {
  const shop = db.shops.find((row) => row.id === transaction.shopId);
  const cashier = db.users.find((row) => row.id === transaction.cashierId);
  const adminProfile = db.adminProfiles.find((row) => row.shopId === transaction.shopId);
  const planType = adminProfile?.planType || "basic";
  const showWatermark = planType !== "pro" && planType !== "business";
  const settings = db.receiptSettings.find((row) => row.shopId === transaction.shopId) ?? { paperWidth: "58mm" as const, logoDataUrl: null, printCopies: 1 as const, showQueueNumber: false, autoPrint: false };
  const onlineOrder = db.onlineOrders.find((row) => row.transactionId === transaction.id);
  const queueNumber = settings.showQueueNumber ? db.transactions.filter((row) => row.shopId === transaction.shopId && row.createdAt.slice(0, 10) === transaction.createdAt.slice(0, 10) && row.createdAt <= transaction.createdAt).length : null;
  const items = db.transactionItems
    .filter((item) => item.transactionId === transaction.id)
    .map((item) => ({
      name: item.name,
      originalPrice: item.originalPrice ?? item.price,
      price: item.price,
      discountAmount: item.discountAmount ?? Math.max(0, (item.originalPrice ?? item.price) - item.price),
      quantity: item.quantity,
      subtotal: item.subtotal,
    }));

  return {
    transaction: {
      invoiceNumber: invoiceNumber(transaction.id),
      createdAt: transaction.createdAt,
      paymentMethod: transaction.paymentMethod,
      subtotal: transaction.subtotal,
      discountAmount: transaction.discountAmount,
      total: transaction.total,
      paidAmount: transaction.paidAmount,
      changeAmount: transaction.changeAmount,
      status: transaction.status,
    },
    items,
    shop: {
      name: shop?.name || "KasirKita",
      address: shop?.address ?? null,
      phone: shop?.phone ?? null,
    },
    cashier: {
      name: cashier?.name || "Kasir",
    },
    publicUrl: receiptPublicUrl(transaction.receiptToken, origin),
    pdfUrl: receiptPdfUrl(transaction.receiptToken, origin),
    showWatermark,
    watermarkText: "www.kasir-kita.com",
    settings,
    queueNumber,
    onlineOrder: onlineOrder ? {
      id: onlineOrder.id,
      orderNumber: onlineOrder.orderNumber || onlineOrderNumber(onlineOrder.id, onlineOrder.createdAt),
      label: "Pesanan Online",
      customerName: onlineOrder.customerName,
      customerPhone: onlineOrder.customerPhone,
      status: onlineOrder.status,
    } : null,
  };
}
