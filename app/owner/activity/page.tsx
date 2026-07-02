import { ActivityLog } from "@/components/activity/activity-log";
import { AppShell } from "@/components/layout/app-shell";

export default function OwnerActivityPage() {
  return (
    <AppShell role="owner" title="Log Aktivitas" description="Pantau aktivitas penting semua cabang dan perubahan data sensitif.">
      <ActivityLog />
    </AppShell>
  );
}
