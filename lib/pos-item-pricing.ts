import { bulkPriceTotal, type BulkPrice } from "@/lib/bulk-pricing";

export type ItemDiscountType = "none" | "percent" | "amount";

export function manualItemDiscount(unitPrice: number, type: ItemDiscountType = "none", value = 0) {
  const price = Math.max(0, Math.round(unitPrice));
  const safeValue = Math.max(0, Math.round(value));
  if (type === "percent") return Math.min(price, Math.round(price * Math.min(safeValue, 100) / 100));
  if (type === "amount") return Math.min(price, safeValue);
  return 0;
}

export function posItemTotal(unitPrice: number, quantity: number, offers: BulkPrice[] | null | undefined, type: ItemDiscountType = "none", value = 0) {
  const packageTotal = bulkPriceTotal(unitPrice, quantity, offers);
  return Math.max(0, packageTotal - manualItemDiscount(unitPrice, type, value) * quantity);
}
