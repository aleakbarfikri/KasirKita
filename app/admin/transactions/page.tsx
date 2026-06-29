import { AppShell } from "@/components/layout/app-shell";
import { TransactionHistory } from "@/components/transactions/transaction-history";

export default function TransactionsPage() {
  return (
    <AppShell role="admin" title="Transaction History" description="Catatan transaksi tunai, QRIS statis, QRIS Pakasir, dan transaksi hutang.">
      <TransactionHistory />
    </AppShell>
  );
}
