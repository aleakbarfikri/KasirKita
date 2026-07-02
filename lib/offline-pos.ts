"use client";

import type { CheckoutPayload, ProductRecord, TransactionRecord } from "@/lib/api-client";

const checkoutQueueKey = "kasirkita:offline-checkouts:v1";
const productCacheKey = "kasirkita:cached-products:v1";
const transactionCacheKey = "kasirkita:cached-transactions:v1";

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
  window.localStorage.setItem(key, JSON.stringify(value));
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

  writeJson(checkoutQueueKey, [...readOfflineCheckouts(), queued]);
  return queued;
}

export function replaceOfflineCheckouts(rows: OfflineCheckout[]) {
  writeJson(checkoutQueueKey, rows);
}

export function cacheProducts(products: ProductRecord[]) {
  writeJson(productCacheKey, { products, cachedAt: new Date().toISOString() });
}

export function readCachedProducts() {
  return readJson<{ products: ProductRecord[]; cachedAt: string } | null>(productCacheKey, null);
}

export function cacheTransactions(transactions: TransactionRecord[]) {
  writeJson(transactionCacheKey, { transactions, cachedAt: new Date().toISOString() });
}

export function readCachedTransactions() {
  return readJson<{ transactions: TransactionRecord[]; cachedAt: string } | null>(transactionCacheKey, null);
}
