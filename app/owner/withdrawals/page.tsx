import { AppShell } from "@/components/layout/app-shell";
import { WithdrawalTable } from "@/components/owner/withdrawal-table";

export default function OwnerWithdrawalsPage() {
  return (
    <AppShell role="owner" title="Riwayat Penarikan" description="Lihat notifikasi withdraw dan tandai transfer manual sebagai selesai.">
      <WithdrawalTable />
    </AppShell>
  );
}
