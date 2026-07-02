import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { productSchema } from "@/lib/server/validators";
import { addAuditLog, now, readDb, sortDesc, writeDb, type Product } from "@/lib/server/data-store";

const productCsvHeaders = ["sku", "nama_barang", "harga_jual", "harga_modal", "stok", "diskon_tipe", "diskon_nilai"];

function csvEscape(value: unknown, delimiter = ";") {
  const text = String(value ?? "");
  return text.includes(delimiter) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: unknown[][]) {
  const delimiter = ";";
  return `\uFEFFsep=${delimiter}\r\n${rows.map((row) => row.map((cell) => csvEscape(cell, delimiter)).join(delimiter)).join("\r\n")}`;
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const db = await readDb();
    const url = new URL(request.url);
    const mode = url.searchParams.get("format");

    if (mode === "template") {
      if (session.user.role !== "admin") return fail("Only admin can download product template", 403);
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
            "Content-Disposition": `attachment; filename="produk-kasirkita-owner.csv"`,
          },
        });
      }
      return ok(sortDesc(rows));
    }

    const scope = await getAdminScope(session.user.id);
    const rows = db.products.filter((product) => product.shopId === scope.shopId && product.isActive);
    if (mode === "csv") {
      const csv = toCsv([
        productCsvHeaders,
        ...sortDesc([...rows]).map((product) => [product.sku, product.name, product.price, product.costPrice, product.stock ?? "", product.discountType ?? "none", product.discountValue ?? 0]),
      ]);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="produk-kasirkita.csv"`,
        },
      });
    }
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

    const db = await readDb();
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
      discountType: body.discountType === "none" ? "none" : body.discountType,
      discountValue: body.discountType === "none" ? 0 : body.discountValue,
      stock: body.stock ?? null,
      photoUrl: body.photoUrl || null,
      isActive: true,
      createdAt: t,
      updatedAt: t,
    };
    db.products.push(created);
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "create_product",
      entityType: "product",
      entityId: created.id,
      message: `Produk ${created.name} ditambahkan ke inventaris.`,
      metadata: { sku: created.sku, price: created.price, stock: created.stock },
    });
    await writeDb(db);
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Nama barang dan harga jual wajib diisi. SKU boleh dikosongkan.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
