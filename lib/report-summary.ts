import { jakartaDateKey } from "@/lib/report-dates";

type SaleRow = {
  createdAt: string;
  status: string;
  total: number;
  costTotal?: number;
  grossProfit?: number;
  items?: Array<{ costPrice?: number | null; quantity: number }>;
};

export function dailyTransactionSummary(rows: SaleRow[], date: string) {
  return rows.reduce((summary, row) => {
    if (row.status !== "success" || jakartaDateKey(row.createdAt) !== date) return summary;
    const cost = row.costTotal ?? row.items?.reduce((total, item) => total + (item.costPrice ?? 0) * item.quantity, 0) ?? 0;
    summary.sales += row.total;
    summary.cost += cost;
    summary.profit += row.grossProfit ?? row.total - cost;
    summary.count += 1;
    return summary;
  }, { sales: 0, cost: 0, profit: 0, count: 0 });
}
