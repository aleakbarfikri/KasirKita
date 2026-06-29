import { AppShell } from "@/components/layout/app-shell";
import { WithdrawalForm } from "@/components/admin/withdrawal-form";

export default function AdminWithdrawPage() {
  return (
    <AppShell role="admin" title="Tarik Dana" description="Ajukan penarikan saldo digital dari transaksi QRIS Pakasir sukses.">
      <WithdrawalForm />
    </AppShell>
  );
}
