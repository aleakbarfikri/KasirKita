import { now, type AppDb } from "@/lib/server/data-store";

export type CsvCostRepairRow = { sku: string; costPrice: number; legacyCostPrice: number | null };

export function repairCsvCosts(db: AppDb, shopId: string, rows: CsvCostRepairRow[], apply: boolean) {
  const products = new Map(db.products.filter((product) => product.shopId === shopId).map((product) => [product.sku.toLowerCase(), product]));
  const itemsByProduct = new Map<string, typeof db.transactionItems>();
  for (const item of db.transactionItems) {
    if (!item.productId) continue;
    const entries = itemsByProduct.get(item.productId) ?? [];
    entries.push(item);
    itemsByProduct.set(item.productId, entries);
  }

  const result = { matchedProducts: 0, correctedProducts: 0, repairedTransactionItems: 0, skippedProducts: 0, unmatchedRows: 0 };
  for (const row of rows) {
    if (!row.sku || row.legacyCostPrice === null) continue;
    const product = products.get(row.sku.toLowerCase());
    if (!product) { result.unmatchedRows += 1; continue; }
    result.matchedProducts += 1;
    if (product.costPrice === row.legacyCostPrice) {
      result.correctedProducts += 1;
      if (apply) { product.costPrice = row.costPrice; product.updatedAt = now(); }
    } else if (product.costPrice !== row.costPrice) {
      result.skippedProducts += 1;
    }
    for (const item of itemsByProduct.get(product.id) ?? []) {
      if (item.costPrice !== row.legacyCostPrice) continue;
      result.repairedTransactionItems += 1;
      if (apply) item.costPrice = row.costPrice;
    }
  }
  return result;
}
