import { AppShell } from "@/components/layout/app-shell";
import { OnlineOrderDashboard } from "@/components/orders/online-order-dashboard";

export default function OnlineOrdersPage() {
  return <AppShell role="admin" title="Pesanan Online" description="Kelola pesanan QRIS KasirKita yang diambil langsung di toko."><OnlineOrderDashboard /></AppShell>;
}
