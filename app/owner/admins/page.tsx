import { AppShell } from "@/components/layout/app-shell";
import { AdminManagement } from "@/components/owner/admin-management";

export default function OwnerAdminsPage() {
  return (
    <AppShell role="owner" title="Manajemen Admin" description="Owner membuat dan mengelola akun admin UMKM/cabang.">
      <AdminManagement />
    </AppShell>
  );
}
