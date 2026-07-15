import type { OnlineOrderStatus, Product } from "@/lib/server/data-store";

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
