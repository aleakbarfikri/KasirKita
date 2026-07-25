"use client";

import type { MeResponse, SessionUser } from "@/lib/api-client";

const sessionCacheKey = "kasirkita:session-cache:v1";

type CachedSession = {
  user: SessionUser;
  shop?: MeResponse["shop"];
  cachedAt: string;
  expiresAt: string;
};

const offlineSessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function cacheSession(me: MeResponse) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  window.localStorage.setItem(sessionCacheKey, JSON.stringify({
    user: me.user,
    shop: me.shop,
    cachedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + offlineSessionLifetimeMs).toISOString(),
  } satisfies CachedSession));
}

export function readCachedSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(sessionCacheKey);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedSession;
    const expiresAt = cached.expiresAt
      ? new Date(cached.expiresAt).getTime()
      : new Date(cached.cachedAt).getTime() + offlineSessionLifetimeMs;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      clearCachedSession();
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export function clearCachedSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionCacheKey);
}
