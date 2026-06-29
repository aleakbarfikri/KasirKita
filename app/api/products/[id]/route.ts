import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { updateProductSchema } from "@/lib/server/validators";
import { now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

async function assertCanAccessProduct(userId: string, role: string | undefined, productId: string) {
  const db = readDb();
  const product = db.products.find((row) => row.id === productId);
  if (!product) throw Object.assign(new Error("Product not found"), { status: 404 });

  if (role === "owner") {
    const shop = db.shops.find((row) => row.id === product.shopId && row.ownerId === userId);
    if (!shop) throw Object.assign(new Error("Product not found"), { status: 404 });
    return;
  }

  const scope = await getAdminScope(userId);
  if (product.shopId !== scope.shopId) throw Object.assign(new Error("Product not found"), { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    await assertCanAccessProduct(session.user.id, session.user.role, params.id);
    const product = readDb().products.find((row) => row.id === params.id) ?? null;
    return ok(product);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    await assertCanAccessProduct(session.user.id, session.user.role, params.id);
    const body = updateProductSchema.parse(await readJson(request));
    const db = readDb();
    const product = db.products.find((row) => row.id === params.id);
    if (!product) return fail("Product not found", 404);

    if (body.sku !== undefined) {
      const nextSku = body.sku.trim() || `SKU-${Date.now().toString().slice(-8)}`;
      if (db.products.some((row) => row.id !== product.id && row.shopId === product.shopId && row.sku === nextSku)) {
        return fail("SKU sudah digunakan di UMKM ini.", 409);
      }
      product.sku = nextSku;
    }
    if (body.name !== undefined) product.name = body.name;
    if (body.price !== undefined) product.price = body.price;
    if (body.costPrice !== undefined) product.costPrice = body.costPrice;
    if (body.stock !== undefined) product.stock = body.stock;
    if (body.photoUrl !== undefined) product.photoUrl = body.photoUrl === "" ? null : body.photoUrl;
    product.updatedAt = now();
    writeDb(db);

    return ok(product);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid product payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    await assertCanAccessProduct(session.user.id, session.user.role, params.id);
    const db = readDb();
    const product = db.products.find((row) => row.id === params.id);
    if (!product) return fail("Product not found", 404);
    product.isActive = false;
    product.updatedAt = now();
    writeDb(db);
    return ok(product);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
