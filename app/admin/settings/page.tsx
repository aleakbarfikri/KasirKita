import { AppShell } from "@/components/layout/app-shell";
import { AccountSettings } from "@/components/settings/account-settings";

export default function AdminSettingsPage() {
  return <AppShell role="admin" title="Pengaturan" description="Kelola profil, email, password, dan keamanan akun dari satu tempat."><AccountSettings role="admin" /></AppShell>;
}
