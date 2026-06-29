import { AppShell } from "@/components/layout/app-shell";
import { DebtLedger } from "@/components/debts/debt-ledger";

export default function OwnerDebtsPage() {
  return (
    <AppShell role="owner" title="Piutang Cabang" description="Pantau semua catatan hutang pelanggan dari cabang/admin.">
      <DebtLedger ownerView />
    </AppShell>
  );
}
