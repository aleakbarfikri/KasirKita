import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { addAuditLog, now, readDb, writeDb, type Product } from "@/lib/server/data-store";

type ImportRow = {
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number | null;
  discountType: "none" | "percent" | "amount";
  discountValue: number;
};

function detectDelimiter(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const firstDataLine = lines.find((line) => !/^sep\s*=/i.test(line.trim())) || "";
  const candidates = [";", ",", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstDataLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ";";
}

function parseCsv(text: string, delimiter = detectDelimiter(text)) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function numberValue(value: string, rowNumber: number, label: string) {
  const normalized = value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw Object.assign(new Error(`Baris ${rowNumber}: ${label} harus angka 0 atau lebih.`), { status: 422 });
  }
  return Math.round(parsed);
}

function discountTypeValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["percent", "persen", "%"].includes(normalized)) return "percent";
  if (["amount", "nominal", "rupiah", "rp"].includes(normalized)) return "amount";
  return "none";
}

function rowsFromCsv(text: string): ImportRow[] {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = parseCsv(cleanText).filter((row) => !/^sep\s*=/i.test(String(row[0] ?? "")));
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const index = {
    sku: headers.findIndex((header) => ["sku", "barcode", "kode"].includes(header)),
    name: headers.findIndex((header) => ["nama_barang", "nama", "product_name", "barang"].includes(header)),
    price: headers.findIndex((header) => ["harga_jual", "harga", "price"].includes(header)),
    costPrice: headers.findIndex((header) => ["harga_modal", "modal", "cost_price"].includes(header)),
    stock: headers.findIndex((header) => ["stok", "stock"].includes(header)),
    discountType: headers.findIndex((header) => ["diskon_tipe", "tipe_diskon", "discount_type"].includes(header)),
    discountValue: headers.findIndex((header) => ["diskon_nilai", "nilai_diskon", "discount_value"].includes(header)),
  };

  if (index.name === -1 || index.price === -1) {
    throw Object.assign(new Error("Format CSV tidak sesuai. Kolom wajib: nama_barang dan harga_jual."), { status: 422 });
  }

  return rows.slice(1).map((row, offset) => {
    const rowNumber = offset + 2;
    const name = String(row[index.name] ?? "").trim();
    if (!name) throw Object.assign(new Error(`Baris ${rowNumber}: nama_barang wajib diisi.`), { status: 422 });
    const price = numberValue(String(row[index.price] ?? ""), rowNumber, "harga_jual");
    const costPrice = index.costPrice === -1 || !row[index.costPrice] ? 0 : numberValue(String(row[index.costPrice]), rowNumber, "harga_modal");
    const stock = index.stock === -1 || row[index.stock] === "" || row[index.stock] === undefined ? null : numberValue(String(row[index.stock]), rowNumber, "stok");
    const discountType = index.discountType === -1 ? "none" : discountTypeValue(String(row[index.discountType] ?? ""));
    const discountValue = index.discountValue === -1 || !row[index.discountValue] ? 0 : numberValue(String(row[index.discountValue]), rowNumber, "diskon_nilai");

    return {
      sku: index.sku === -1 ? "" : String(row[index.sku] ?? "").trim(),
      name,
      price,
      costPrice,
      stock,
      discountType,
      discountValue: discountType === "none" ? 0 : discountValue,
    };
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Only admin can import products", 403);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("File CSV wajib di-upload.", 422);
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".txt")) {
      return fail("Untuk saat ini gunakan file CSV dari Excel. Download template dulu, isi di Excel, lalu Save As CSV.", 422);
    }

    const scope = await getAdminScope(session.user.id);
    const importedRows = rowsFromCsv(await file.text());
    if (!importedRows.length) return fail("File CSV kosong atau belum berisi produk.", 422);

    const seenSku = new Set<string>();
    for (const row of importedRows) {
      if (!row.sku) continue;
      const normalizedSku = row.sku.toLowerCase();
      if (seenSku.has(normalizedSku)) return fail(`SKU duplikat di file: ${row.sku}`, 422);
      seenSku.add(normalizedSku);
    }

    const db = await readDb();
    const timestamp = now();
    let created = 0;
    let updated = 0;

    for (const row of importedRows) {
      const sku = row.sku || `SKU-${Date.now().toString().slice(-8)}-${created + updated + 1}`;
      const existing = db.products.find((product) => product.shopId === scope.shopId && product.sku.toLowerCase() === sku.toLowerCase());
      if (existing) {
        existing.name = row.name;
        existing.price = row.price;
        existing.costPrice = row.costPrice;
        existing.stock = row.stock;
        existing.discountType = row.discountType;
        existing.discountValue = row.discountValue;
        existing.isActive = true;
        existing.updatedAt = timestamp;
        updated += 1;
      } else {
        const product: Product = {
          id: createId("prd"),
          shopId: scope.shopId,
          sku,
          name: row.name,
          price: row.price,
          costPrice: row.costPrice,
          discountType: row.discountType,
          discountValue: row.discountValue,
          stock: row.stock,
          photoUrl: null,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        db.products.push(product);
        created += 1;
      }
    }

    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "import_products",
      entityType: "product",
      message: `Import produk selesai: ${created} baru, ${updated} diperbarui.`,
      metadata: { created, updated, total: importedRows.length },
    });

    await writeDb(db);
    return ok({ created, updated, total: importedRows.length }, { status: 201 });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
