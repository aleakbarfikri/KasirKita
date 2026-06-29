import { AppShell } from "@/components/layout/app-shell";
import { PosInterface } from "@/components/pos/pos-interface";

export default function PosPage() {
  return (
    <AppShell role="admin" title="POS Kasir" description="" fullScreen>
      <PosInterface />
    </AppShell>
  );
}
