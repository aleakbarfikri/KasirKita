import type { AppDb } from "@/lib/server/data-store";

export function repairLegacyTransactionCosts(db: AppDb, productId: string, legacyCost: number | null, correctedCost: number) {
  if (legacyCost === null || legacyCost === correctedCost) return 0;
  let repaired = 0;
  for (const item of db.transactionItems) {
    if (item.productId === productId && item.costPrice === legacyCost) {
      item.costPrice = correctedCost;
      repaired += 1;
    }
  }
  return repaired;
}
