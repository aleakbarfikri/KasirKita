import type { AppDb, OnlineOrderStatus, Product } from "@/lib/server/data-store";
import { paymentDeadline } from "@/lib/server/subscription-invoice-retention";

export const ONLINE_ORDER_UNPAID_RETENTION_MS = 24 * 60 * 60 * 1000;

export function onlineOrderProductPrice(product: Pick<Product, "price" | "discountType" | "discountValue">) {
  const value = Math.max(0, product.discountValue ?? 0);
  if (product.discountType === "percent") return Math.max(0, Math.round(product.price * (1 - Math.min(value, 100) / 100)));
  if (product.discountType === "amount") return Math.max(0, product.price - value);
  return product.price;
}

const transitions: Partial<Record<OnlineOrderStatus, OnlineOrderStatus[]>> = {
  paid: ["processing"],
  processing: ["ready"],
  ready: ["completed"],
  pending_payment: ["cancelled"],
};

export function canTransitionOnlineOrder(current: OnlineOrderStatus, next: OnlineOrderStatus) {
  return (transitions[current] ?? []).includes(next);
}

export function onlineOrderNumber(id: string, createdAt: string) {
  const date = new Date(createdAt);
  const day = Number.isNaN(date.getTime()) ? "00000000" : date.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase().padStart(8, "0");
  return `ONL-${day}-${suffix}`;
}

export function isOnlineOrderVisible(status: OnlineOrderStatus, updatedAt: string, currentTime = Date.now()) {
  if (["pending_payment", "paid", "processing", "ready"].includes(status)) return true;
  const updated = new Date(updatedAt).getTime();
  return Number.isNaN(updated) || currentTime - updated < 24 * 60 * 60 * 1000;
}

export function normalizedCustomerEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizedCustomerPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function activeOnlineOrdersForCustomer(db: AppDb, shopId: string, email: string, phone: string, currentTime = Date.now()) {
  const normalizedEmail = normalizedCustomerEmail(email);
  const normalizedPhone = normalizedCustomerPhone(phone);
  return db.onlineOrders.filter((order) => {
    if (order.shopId !== shopId || order.status !== "pending_payment") return false;
    const deadline = new Date(paymentDeadline({ createdAt: order.createdAt, expiredAt: order.expiredAt })).getTime();
    if (!Number.isFinite(deadline) || deadline <= currentTime) return false;
    return normalizedCustomerEmail(order.customerEmail) === normalizedEmail || normalizedCustomerPhone(order.customerPhone) === normalizedPhone;
  });
}

export function maintainOnlineOrders(db: AppDb, currentTime = Date.now()) {
  const removable = new Set<string>();

  for (const order of db.onlineOrders) {
    if (!["payment_failed", "cancelled"].includes(order.status)) continue;
    const terminalAt = new Date(order.updatedAt).getTime();
    if (Number.isFinite(terminalAt) && currentTime - terminalAt >= ONLINE_ORDER_UNPAID_RETENTION_MS) removable.add(order.id);
  }

  if (!removable.size) return { removed: 0 };
  const transactionIds = new Set(db.onlineOrders.filter((order) => removable.has(order.id)).map((order) => order.transactionId));
  db.onlineOrders = db.onlineOrders.filter((order) => !removable.has(order.id));
  db.transactions = db.transactions.filter((transaction) => !transactionIds.has(transaction.id));
  db.transactionItems = db.transactionItems.filter((item) => !transactionIds.has(item.transactionId));
  db.auditLogs = db.auditLogs.filter((log) => !(log.entityType === "online_order" && log.entityId && removable.has(log.entityId)));
  return { removed: removable.size };
}
