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
  return dateRangeTransactionSummary(rows, date, date);
}

export function dateRangeTransactionSummary(rows: SaleRow[], startDate: string, endDate: string) {
  return rows.reduce((summary, row) => {
    const date = jakartaDateKey(row.createdAt);
    if (row.status !== "success" || !date || date < startDate || date > endDate) return summary;
    const cost = row.costTotal ?? row.items?.reduce((total, item) => total + (item.costPrice ?? 0) * item.quantity, 0) ?? 0;
    summary.sales += row.total;
    summary.cost += cost;
    summary.profit += row.grossProfit ?? row.total - cost;
    summary.count += 1;
    return summary;
  }, { sales: 0, cost: 0, profit: 0, count: 0 });
}
