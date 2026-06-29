import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { productSchema } from "@/lib/server/validators";
import { now, readDb, sortDesc, writeDb, type Product } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAuth();
    const db = readDb();

    if (session.user.role === "owner") {
      const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
      const rows = db.products
        .filter((product) => ownerShops.some((shop) => shop.id === product.shopId))
        .map((product) => ({ ...product, shopName: ownerShops.find((shop) => shop.id === product.shopId)?.name }));
      return ok(sortDesc(rows));
    }

    const scope = await getAdminScope(session.user.id);
    const rows = db.products.filter((product) => product.shopId === scope.shopId && product.isActive);
    return ok(sortDesc(rows));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Only admin can create inventory from this endpoint", 403);

    const scope = await getAdminScope(session.user.id);
    const body = productSchema.parse(await readJson(request));
    const sku = body.sku?.trim() || `SKU-${Date.now().toString().slice(-8)}`;
    const t = now();

    const db = readDb();
    if (db.products.some((product) => product.shopId === scope.shopId && product.sku === sku)) {
      return fail("SKU sudah digunakan di UMKM ini.", 409);
    }

    const created: Product = {
      id: createId("prd"),
      shopId: scope.shopId,
      sku,
      name: body.name,
      price: body.price,
      costPrice: body.costPrice,
      stock: body.stock ?? null,
      photoUrl: body.photoUrl || null,
      isActive: true,
      createdAt: t,
      updatedAt: t,
    };
    db.products.push(created);
    writeDb(db);
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Nama barang dan harga jual wajib diisi. SKU boleh dikosongkan.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
