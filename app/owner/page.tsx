import { AppShell } from "@/components/layout/app-shell";
import { OwnerDashboardClient } from "@/components/dashboard/owner-dashboard-client";

export default function OwnerDashboardPage() {
  return (
    <AppShell role="owner" title="Dashboard Owner" description="Ringkasan performa KasirKita dari API backend.">
      <OwnerDashboardClient />
    </AppShell>
  );
}
