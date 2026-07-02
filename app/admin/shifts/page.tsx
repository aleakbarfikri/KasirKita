import { AppShell } from "@/components/layout/app-shell";
import { ShiftManager } from "@/components/shifts/shift-manager";

export default function AdminShiftsPage() {
  return (
    <AppShell role="admin" title="Shift Kasir" description="Tutup shift, hitung uang tunai fisik, dan lihat rekap kasir.">
      <ShiftManager />
    </AppShell>
  );
}
