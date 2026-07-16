import sharp from "sharp";
import { del, put } from "@vercel/blob";

import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { addAuditLog, now, readDb, writeDb } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";
import { assertFeatureAllowed } from "@/lib/server/subscription";

type Params = { params: Promise<{ id: string }> };

const MAX_COMPRESSED_UPLOAD_BYTES = 8 * 1024 * 1024;
const PRODUCT_IMAGE_PREFIX = "product-images/";

function blobToken() {
  const token = process.env.KASIRKITA_PRODUCT_BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) throw Object.assign(new Error("Blob storage foto produk belum dikonfigurasi."), { status: 503 });
  return token;
}

function productPath(shopId: string, productId: string) {
  return `${PRODUCT_IMAGE_PREFIX}${shopId}/${productId}.webp`;
}

export async function optimizedProductImage(input: Buffer) {
  const source = sharp(input, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw Object.assign(new Error("File gambar tidak valid."), { status: 422 });

  let output = await source
    .clone()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 74, effort: 5 })
    .toBuffer();

  if (output.length > 450_000) {
    output = await source
      .clone()
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 64, effort: 5 })
      .toBuffer();
  }
  return output;
}

export async function POST(request: Request, props: Params) {
  const { id } = await props.params;
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Hanya Admin yang dapat mengubah foto produk.", 403);
    const scope = await getAdminScope(session.user.id);
    assertFeatureAllowed(scope.adminProfile, "productPhotos");

    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) return fail("Pilih file foto produk terlebih dahulu.", 422);
    if (!file.type.startsWith("image/")) return fail("File harus berupa gambar.", 422);
    if (file.size <= 0 || file.size > MAX_COMPRESSED_UPLOAD_BYTES) return fail("Gambar hasil kompresi terlalu besar. Pilih gambar lain.", 413);

    const db = await readDb();
    const product = db.products.find((row) => row.id === id && row.shopId === scope.shopId);
    if (!product) return fail("Produk tidak ditemukan.", 404);

    const output = await optimizedProductImage(Buffer.from(await file.arrayBuffer()));
    const pathname = productPath(scope.shopId, product.id);
    const uploaded = await put(pathname, output, {
      token: blobToken(),
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/webp",
      cacheControlMaxAge: 31536000,
    });
    product.photoUrl = `${uploaded.url}?v=${Date.now()}`;
    product.updatedAt = now();
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "update_product",
      entityType: "product",
      entityId: product.id,
      message: `Foto produk ${product.name} diperbarui dan dikompres ke WebP.`,
      metadata: { sourceBytes: file.size, storedBytes: output.length, format: "webp" },
    });
    await writeDb(db);
    return ok({ product, storedBytes: output.length });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function DELETE(_request: Request, props: Params) {
  const { id } = await props.params;
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Hanya Admin yang dapat mengubah foto produk.", 403);
    const scope = await getAdminScope(session.user.id);
    assertFeatureAllowed(scope.adminProfile, "productPhotos");
    const db = await readDb();
    const product = db.products.find((row) => row.id === id && row.shopId === scope.shopId);
    if (!product) return fail("Produk tidak ditemukan.", 404);

    await del(productPath(scope.shopId, product.id), { token: blobToken() });
    product.photoUrl = null;
    product.updatedAt = now();
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "update_product",
      entityType: "product",
      entityId: product.id,
      message: `Foto produk ${product.name} dihapus.`,
    });
    await writeDb(db);
    return ok(product);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
