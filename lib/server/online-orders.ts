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
