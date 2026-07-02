import { CashierManager } from "@/components/admin/cashier-manager";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminCashiersPage() {
  return (
    <AppShell role="admin" title="Kelola Kasir" description="Buat akun kasir, cek status approval owner, dan ubah password kasir.">
      <CashierManager />
    </AppShell>
  );
}
