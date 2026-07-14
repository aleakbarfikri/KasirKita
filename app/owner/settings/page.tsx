import { AppShell } from "@/components/layout/app-shell";
import { AccountSettings } from "@/components/settings/account-settings";

export default function OwnerSettingsPage() {
  return <AppShell role="owner" title="Pengaturan" description="Kelola profil, email, password, dan keamanan akun Owner."><AccountSettings role="owner" /></AppShell>;
}
