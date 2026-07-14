import type { AppDb, Shop } from "@/lib/server/data-store";

export function findOnlineStore(db: AppDb, identifier: string): Shop | undefined {
  const normalized = decodeURIComponent(identifier).trim().toLowerCase();
  return db.shops.find((shop) => shop.id === identifier || shop.onlineStoreSlug?.toLowerCase() === normalized);
}
