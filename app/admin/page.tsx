import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AdminDashboardClient } from "@/components/dashboard/admin-dashboard-client";

export default function AdminDashboardPage() {
  return (
    <AppShell role="admin" title="Dashboard Admin" description="Ringkasan transaksi, saldo, stok, hutang, dan aktivitas cabang.">
      <Suspense fallback={<div className="rounded-2xl bg-white p-4 font-semibold shadow">Memuat dashboard...</div>}>
        <AdminDashboardClient />
      </Suspense>
    </AppShell>
  );
}
