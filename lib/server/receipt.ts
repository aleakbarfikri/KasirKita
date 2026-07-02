import type { AppDb, Transaction } from "@/lib/server/data-store";

export function receiptPublicUrl(token: string | null | undefined, origin?: string | null) {
  if (!token) return undefined;
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "";
  return base ? `${base.replace(/\/$/, "")}/r/${token}` : `/r/${token}`;
}

export function buildReceipt(db: AppDb, transaction: Transaction, origin?: string | null) {
  const shop = db.shops.find((row) => row.id === transaction.shopId);
  const cashier = db.users.find((row) => row.id === transaction.cashierId);
  const items = db.transactionItems
    .filter((item) => item.transactionId === transaction.id)
    .map((item) => ({
      productId: item.productId ?? undefined,
      sku: item.sku,
      name: item.name,
      originalPrice: item.originalPrice ?? item.price,
      price: item.price,
      discountAmount: item.discountAmount ?? Math.max(0, (item.originalPrice ?? item.price) - item.price),
      quantity: item.quantity,
    }));

  return {
    transaction,
    items,
    shop: {
      name: shop?.name || "KasirKita",
      address: shop?.address ?? null,
      phone: shop?.phone ?? null,
    },
    cashier: {
      name: cashier?.name || "Kasir",
    },
    publicUrl: receiptPublicUrl(transaction.receiptToken, origin),
  };
}
