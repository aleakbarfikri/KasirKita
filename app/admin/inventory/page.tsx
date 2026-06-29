import { AppShell } from "@/components/layout/app-shell";
import { InventoryManager } from "@/components/admin/inventory-manager";

export default function InventoryPage() {
  return (
    <AppShell role="admin" title="Manajemen Inventaris" description="Input produk, harga jual, harga modal, dan SKU/barcode.">
      <InventoryManager />
    </AppShell>
  );
}
