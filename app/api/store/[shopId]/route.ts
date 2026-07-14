import { fail, ok } from "@/lib/server/http";
import { isAdminProfileActive, readDb } from "@/lib/server/data-store";

type Params = { params: Promise<{ shopId: string }> };

export async function GET(_request: Request, props: Params) {
  const { shopId } = await props.params;
  const db = await readDb();
  const shop = db.shops.find((row) => row.id === shopId);
  const profile = db.adminProfiles.find((row) => row.shopId === shopId);
  if (!shop || !profile || !isAdminProfileActive(profile)) return fail("Toko online tidak tersedia.", 404);
  const products = db.products
    .filter((row) => row.shopId === shopId && row.isActive && (row.stock === null || row.stock === undefined || row.stock > 0))
    .map((row) => ({ id: row.id, sku: row.sku, name: row.name, price: row.price, discountType: row.discountType ?? "none", discountValue: row.discountValue ?? 0, stock: row.stock, photoUrl: row.photoUrl ?? null }));
  return ok({ shop: { id: shop.id, name: shop.name, address: shop.address ?? null, phone: shop.phone ?? null }, products, fulfillment: "pickup" as const, paymentMethod: "qris_pakasir" as const });
}
