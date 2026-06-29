import { AppShell } from "@/components/layout/app-shell";
import { PaymentConfigForm } from "@/components/owner/payment-config-form";

export default function OwnerPaymentsPage() {
  return (
    <AppShell role="owner" title="Konfigurasi Pembayaran" description="Atur slug dan API Key Pakasir untuk QRIS dinamis.">
      <PaymentConfigForm />
    </AppShell>
  );
}
