import { AppShell } from "@/components/layout/app-shell";
import { DebtLedger } from "@/components/debts/debt-ledger";

export default function AdminDebtsPage() {
  return (
    <AppShell role="admin" title="Catatan Hutang" description="Buku hutang pelanggan: catat transaksi bayar nanti, pantau jatuh tempo, dan tandai lunas.">
      <DebtLedger />
    </AppShell>
  );
}
