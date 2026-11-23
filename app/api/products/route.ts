import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { productSchema } from "@/lib/server/validators";
import { addAuditLog, now, readDb, sortDesc, withDbTransaction, type Product } from "@/lib/server/data-store";
import { assertFeatureAllowed, assertProductLimit } from "@/lib/server/subscription";

const productCsvHeaders = ["sku", "nama_barang", "harga_jual", "harga_modal", "stok", "diskon_tipe", "diskon_nilai"];

function csvEscape(value: unknown, delimiter = ";") {
  const text = String(value ?? "");
  return text.includes(delimiter) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]) {
  const delimiter = ";";
  return `\uFEFFsep=${delimiter}\r\n${rows.map((row) => row.map((cell) => csvEscape(cell, delimiter)).join(delimiter)).join("\r\n")}`;
}

function exportStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const db = await readDb();
    const url = new URL(request.url);
    const mode = url.searchParams.get("format");
    const lowStockOnly = url.searchParams.get("lowStock") === "1";

    if (mode === "template") {
      if (session.user.role !== "admin") return fail("Only admin can download product template", 403);
      const scope = await getAdminScope(session.user.id);
      assertFeatureAllowed(scope.adminProfile, "importExport");
      const csv = toCsv([
        productCsvHeaders,
        ["SKU-001", "Gula 1kg", 15000, 12500, 50, "percent", 10],
        ["SKU-002", "Kopi Sachet", 3000, 2000, 100, "amount", 500],
      ]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="template-produk-kasirkita.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (session.user.role === "owner") {
      const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
      const rows = db.products
        .filter((product) => ownerShops.some((shop) => shop.id === product.shopId))
        .map((product) => ({ ...product, shopName: ownerShops.find((shop) => shop.id === product.shopId)?.name }));
      if (mode === "csv") {
        const csv = toCsv([
          ["shop_name", ...productCsvHeaders],
          ...sortDesc(rows).map((product) => [product.shopName ?? "", product.sku, product.name, product.price, product.costPrice, product.stock ?? "", product.discountType ?? "none", product.discountValue ?? 0]),
        ]);
        return new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="produk-kasirkita-owner-${exportStamp()}.csv"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      return ok(sortDesc(lowStockOnly ? rows.filter((product) => product.isActive !== false && product.stock !== null && product.stock !== undefined && product.stock <= 5) : rows));
    }

    const scope = await getAdminScope(session.user.id);
    const rows = db.products.filter((product) => product.shopId === scope.shopId);
    if (mode === "csv") {
      assertFeatureAllowed(scope.adminProfile, "importExport");
      const csv = toCsv([
        productCsvHeaders,
        ...sortDesc([...rows]).map((product) => [product.sku, product.name, product.price, product.costPrice, product.stock ?? "", product.discountType ?? "none", product.discountValue ?? 0]),
      ]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="produk-kasirkita-${exportStamp()}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    return ok(sortDesc(lowStockOnly ? rows.filter((product) => product.isActive !== false && product.stock !== null && product.stock !== undefined && product.stock <= 5) : rows));
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
    if (body.bulkPrices.some((offer) => offer.total >= body.price * offer.quantity)) return fail("Harga paket harus lebih murah daripada harga satuan × jumlah.", 422);
    if (body.discountType && body.discountType !== "none" && body.discountValue > 0) assertFeatureAllowed(scope.adminProfile, "discounts");
    const sku = body.sku?.trim() || `SKU-${Date.now().toString().slice(-8)}`;
    const t = now();

    const created = await withDbTransaction((db) => {
      if (db.products.some((product) => product.shopId === scope.shopId && product.sku === sku)) {
        throw Object.assign(new Error("SKU sudah digunakan di UMKM ini."), { status: 409 });
      }
      assertProductLimit(db, scope.adminProfile);
      const product: Product = {
        id: createId("prd"), shopId: scope.shopId, sku, name: body.name,
        price: body.price, costPrice: body.costPrice,
        discountType: body.discountType === "none" ? "none" : body.discountType,
        discountValue: body.discountType === "none" ? 0 : body.discountValue,
        bulkPrices: body.bulkPrices, stock: body.stock ?? null,
        photoUrl: body.photoUrl || null, isActive: true, createdAt: t, updatedAt: t,
      };
      db.products.push(product);
      addAuditLog(db, {
        actorId: session.user.id, actorRole: "admin", shopId: scope.shopId,
        action: "create_product", entityType: "product", entityId: product.id,
        message: `Produk ${product.name} ditambahkan ke inventaris.`,
        metadata: { sku: product.sku, price: product.price, stock: product.stock },
      });
      return product;
    });
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Nama barang dan harga jual wajib diisi. SKU boleh dikosongkan.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
