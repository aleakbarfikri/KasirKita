export type BulkPrice = { quantity: number; total: number };

/** A configured quantity is an exact offer; larger carts reuse the largest offer. */
export function bulkPriceTotal(unitPrice: number, quantity: number, offers?: BulkPrice[] | null) {
  const regularTotal = unitPrice * quantity;
  if (!offers?.length || quantity < 2) return regularTotal;
  const sorted = [...offers].sort((a, b) => b.quantity - a.quantity);
  let remaining = quantity;
  let total = 0;
  for (const offer of sorted) {
    if (offer.quantity < 2 || offer.total < 0) continue;
    const count = Math.floor(remaining / offer.quantity);
    total += count * offer.total;
    remaining -= count * offer.quantity;
  }
  return Math.min(regularTotal, total + remaining * unitPrice);
}
