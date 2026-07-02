import { AppShell } from "@/components/layout/app-shell";
import { AdminDashboardClient } from "@/components/dashboard/admin-dashboard-client";

export default function AdminDashboardPage() {
  return (
    <AppShell role="admin" title="Dashboard Admin" description="Ringkasan transaksi, saldo, stok, hutang, dan aktivitas cabang.">
      <AdminDashboardClient />
    </AppShell>
  );
}
