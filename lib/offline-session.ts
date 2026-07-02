"use client";

import type { MeResponse, SessionUser } from "@/lib/api-client";

const sessionCacheKey = "kasirkita:session-cache:v1";

type CachedSession = {
  user: SessionUser;
  cachedAt: string;
};

export function cacheSession(me: MeResponse) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(sessionCacheKey, JSON.stringify({
    user: me.user,
    cachedAt: new Date().toISOString(),
  } satisfies CachedSession));
}

export function readCachedSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(sessionCacheKey);
    return raw ? (JSON.parse(raw) as CachedSession) : null;
  } catch {
    return null;
  }
}

export function clearCachedSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(sessionCacheKey);
}
