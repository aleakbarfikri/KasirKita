import { ActivityLog } from "@/components/activity/activity-log";
import { AppShell } from "@/components/layout/app-shell";

export default function AdminActivityPage() {
  return (
    <AppShell role="admin" title="Log Aktivitas" description="Pantau aktivitas penting seperti transaksi, void, hutang, shift, dan restore.">
      <ActivityLog />
    </AppShell>
  );
}
