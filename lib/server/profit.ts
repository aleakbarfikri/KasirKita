import type { AppDb, Transaction, TransactionItem } from "@/lib/server/data-store";

export function itemCostPrice(db: AppDb, item: TransactionItem) {
  if (typeof item.costPrice === "number") return item.costPrice;
  if (!item.productId) return 0;
  return db.products.find((product) => product.id === item.productId)?.costPrice ?? 0;
}

export function transactionProfit(db: AppDb, transaction: Transaction) {
  if (transaction.status !== "success") return { costTotal: 0, grossProfit: 0 };
  const items = db.transactionItems.filter((item) => item.transactionId === transaction.id);
  const costTotal = items.reduce((sum, item) => sum + itemCostPrice(db, item) * item.quantity, 0);
  const grossProfit = transaction.total - costTotal;
  return { costTotal, grossProfit };
}

export function profitSummary(db: AppDb, transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.status === "success")
    .reduce(
      (summary, transaction) => {
        const profit = transactionProfit(db, transaction);
        summary.revenue += transaction.total;
        summary.cost += profit.costTotal;
        summary.grossProfit += profit.grossProfit;
        return summary;
      },
      { revenue: 0, cost: 0, grossProfit: 0 },
    );
}
