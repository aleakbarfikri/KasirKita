import { now, type AppDb, type TransactionItem } from "@/lib/server/data-store";

type StockItem = Pick<TransactionItem, "productId" | "quantity" | "name">;

type StockOptions = {
  validateOnly?: boolean;
  allowNegative?: boolean;
  ignoreMissing?: boolean;
};

function stockError(message: string) {
  return Object.assign(new Error(message), { status: 422 });
}

function stockNeedsTracking(stock: number | null | undefined) {
  return stock !== null && stock !== undefined;
}

export function applySuccessfulTransactionStock(db: AppDb, shopId: string, items: StockItem[], options: StockOptions = {}) {
  const quantities = new Map<string, { quantity: number; name: string }>();

  for (const item of items) {
    if (!item.productId) continue;
    const current = quantities.get(item.productId);
    quantities.set(item.productId, {
      quantity: (current?.quantity ?? 0) + item.quantity,
      name: current?.name || item.name,
    });
  }

  for (const [productId, item] of Array.from(quantities.entries())) {
    const product = db.products.find((row) => row.id === productId && row.shopId === shopId && row.isActive);
    if (!product) {
      if (options.ignoreMissing) continue;
      throw stockError(`Produk ${item.name} tidak ditemukan di inventaris.`);
    }

    if (!stockNeedsTracking(product.stock)) continue;
    if (!options.allowNegative && product.stock! < item.quantity) {
      throw stockError(`Stok ${product.name} tidak cukup. Tersedia ${product.stock}, diminta ${item.quantity}.`);
    }
  }

  if (options.validateOnly) return;

  const timestamp = now();
  for (const [productId, item] of Array.from(quantities.entries())) {
    const product = db.products.find((row) => row.id === productId && row.shopId === shopId && row.isActive);
    if (!product || !stockNeedsTracking(product.stock)) continue;
    product.stock = product.stock! - item.quantity;
    product.updatedAt = timestamp;
  }
}

export function restoreSuccessfulTransactionStock(db: AppDb, shopId: string, items: StockItem[]) {
  const quantities = new Map<string, { quantity: number; name: string }>();

  for (const item of items) {
    if (!item.productId) continue;
    const current = quantities.get(item.productId);
    quantities.set(item.productId, {
      quantity: (current?.quantity ?? 0) + item.quantity,
      name: current?.name || item.name,
    });
  }

  const timestamp = now();
  for (const [productId, item] of Array.from(quantities.entries())) {
    const product = db.products.find((row) => row.id === productId && row.shopId === shopId);
    if (!product || !stockNeedsTracking(product.stock)) continue;
    product.stock = product.stock! + item.quantity;
    product.updatedAt = timestamp;
  }
}
