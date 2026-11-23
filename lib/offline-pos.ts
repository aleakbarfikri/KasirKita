"use client";

import type { CheckoutPayload, ProductRecord, TransactionRecord } from "@/lib/api-client";
import { clearOfflineRecords, readOfflineRecord, requestPersistentOfflineStorage, writeOfflineRecord, type OfflineRecordKey } from "@/lib/offline-db";
import { applyOfflineStockReservation } from "@/lib/offline-stock";

const checkoutQueueKey = "kasirkita:offline-checkouts:v1";
const productCacheKey = "kasirkita:cached-products:v1";
const transactionCacheKey = "kasirkita:cached-transactions:v1";
const metadataKey = "kasirkita:offline-metadata:v2";
const offlineChangeEvent = "kasirkita:offline-data-changed";

type OfflineMetadata = Partial<Record<OfflineRecordKey, number>>;
type ProductCache = { products: ProductRecord[]; cachedAt: string };
type TransactionCache = { transactions: TransactionRecord[]; cachedAt: string };
export const PRODUCT_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

export function isProductCacheFresh(cache: ProductCache | null, now = Date.now()) {
  const cachedAt = cache ? Date.parse(cache.cachedAt) : NaN;
  return Boolean(cache && Number.isFinite(cachedAt) && cachedAt <= now && now - cachedAt < PRODUCT_CACHE_MAX_AGE_MS);
}

export type OfflineCheckout = {
  id: string;
  payload: CheckoutPayload;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // IndexedDB remains the durable source if the small synchronous mirror is full.
  }
}

function readMetadata() {
  return readJson<OfflineMetadata>(metadataKey, {});
}

function persistRecord<T>(recordKey: OfflineRecordKey, storageKey: string, value: T) {
  const updatedAt = Date.now();
  writeJson(storageKey, value);
  writeJson(metadataKey, { ...readMetadata(), [recordKey]: updatedAt });
  void writeOfflineRecord(recordKey, value, updatedAt);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(offlineChangeEvent, { detail: recordKey }));
}

function cacheAdjustedStock(payload: CheckoutPayload) {
  const cached = readCachedProducts();
  if (!cached?.products.length) return;
  persistRecord("products", productCacheKey, {
    products: applyOfflineStockReservation(cached.products, payload),
    cachedAt: cached.cachedAt,
  } satisfies ProductCache);
}

/** A confirmed checkout has already reserved stock on the server. Keep this tab current without downloading the full catalogue again. */
export function applyConfirmedCheckoutToCache(payload: CheckoutPayload) {
  cacheAdjustedStock(payload);
}

async function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const syncManager = registration && "sync" in registration
    ? (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync
    : null;
  await syncManager?.register("kasirkita-sync-checkouts").catch(() => undefined);
}

export function readOfflineCheckouts() {
  return readJson<OfflineCheckout[]>(checkoutQueueKey, []);
}

export function enqueueOfflineCheckout(payload: CheckoutPayload) {
  const queued: OfflineCheckout = {
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  persistRecord("checkoutQueue", checkoutQueueKey, [...readOfflineCheckouts(), queued]);
  cacheAdjustedStock(payload);
  void requestBackgroundSync();
  return queued;
}

export function replaceOfflineCheckouts(rows: OfflineCheckout[]) {
  persistRecord("checkoutQueue", checkoutQueueKey, rows);
}

export function cacheProducts(products: ProductRecord[]) {
  persistRecord("products", productCacheKey, { products, cachedAt: new Date().toISOString() } satisfies ProductCache);
}

export function readCachedProducts() {
  return readJson<ProductCache | null>(productCacheKey, null);
}

export function cacheTransactions(transactions: TransactionRecord[]) {
  persistRecord("transactions", transactionCacheKey, { transactions, cachedAt: new Date().toISOString() } satisfies TransactionCache);
}

export function readCachedTransactions() {
  return readJson<TransactionCache | null>(transactionCacheKey, null);
}

export async function initializeOfflinePos() {
  if (typeof window === "undefined") return;
  await requestPersistentOfflineStorage();

  const metadata = readMetadata();
  const records = await Promise.all([
    readOfflineRecord<ProductCache>("products"),
    readOfflineRecord<TransactionCache>("transactions"),
    readOfflineRecord<OfflineCheckout[]>("checkoutQueue"),
  ]);
  const mappings = [
    { recordKey: "products" as const, storageKey: productCacheKey, record: records[0], localValue: readCachedProducts() },
    { recordKey: "transactions" as const, storageKey: transactionCacheKey, record: records[1], localValue: readCachedTransactions() },
    { recordKey: "checkoutQueue" as const, storageKey: checkoutQueueKey, record: records[2], localValue: readOfflineCheckouts() },
  ];

  for (const mapping of mappings) {
    const localUpdatedAt = metadata[mapping.recordKey] ?? 0;
    if (mapping.record && mapping.record.updatedAt > localUpdatedAt) {
      writeJson(mapping.storageKey, mapping.record.value);
      writeJson(metadataKey, { ...readMetadata(), [mapping.recordKey]: mapping.record.updatedAt });
    } else if (!mapping.record && mapping.localValue) {
      void writeOfflineRecord(mapping.recordKey, mapping.localValue, localUpdatedAt || Date.now());
    }
  }
}

export function subscribeOfflineData(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(offlineChangeEvent, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(offlineChangeEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function clearOfflineData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(checkoutQueueKey);
  window.localStorage.removeItem(productCacheKey);
  window.localStorage.removeItem(transactionCacheKey);
  window.localStorage.removeItem(metadataKey);
  await clearOfflineRecords();
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    registration?.active?.postMessage({ type: "CLEAR_PRIVATE_CACHE" });
  }
}
