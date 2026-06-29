import { AppShell } from "@/components/layout/app-shell";
import { AdminDashboardClient } from "@/components/dashboard/admin-dashboard-client";

export default function AdminDashboardPage() {
  return (
    <AppShell role="admin" title="Dashboard Admin" description="Dashboard khusus UMKM/Cabang untuk saldo digital, omzet, transaksi, dan hutang pelanggan.">
      <AdminDashboardClient />
    </AppShell>
  );
}
