import type { CheckoutPayload, ProductRecord } from "@/lib/api-client";

export function applyOfflineStockReservation(products: ProductRecord[], payload: CheckoutPayload) {
  const quantities = new Map<string, number>();
  for (const item of payload.items) {
    if (!item.productId) continue;
    const quantity = Math.max(0, Math.floor(item.quantity));
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + quantity);
  }

  if (quantities.size === 0) return products;
  return products.map((product) => {
    const quantity = quantities.get(product.id);
    if (!quantity || product.stock === null || product.stock === undefined) return product;
    return { ...product, stock: Math.max(0, product.stock - quantity) };
  });
}
