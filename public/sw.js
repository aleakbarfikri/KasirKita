const CORE_CACHE = "kasirkita-core-v4";
const RUNTIME_CACHE = "kasirkita-runtime-v2";
const POS_PATH = "/admin/pos";
const OFFLINE_ROUTES = new Set([POS_PATH, "/admin/inventory", "/admin/transactions"]);
const CORE_ASSETS = [
  "/offline.html",
  "/kasirkita-mark.png",
  "/kasirkita-logo.png",
  "/manifest.webmanifest"
];
const MAX_RUNTIME_ENTRIES = 180;

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function normalizedRequest(pathname) {
  return new Request(new URL(pathname, self.location.origin).toString(), {
    credentials: "include"
  });
}

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const overflow = keys.length - MAX_RUNTIME_ENTRIES;
  if (overflow <= 0) return;
  await Promise.all(keys.slice(0, overflow).map((key) => cache.delete(key)));
}

async function cacheValidAppShell(pathname, response) {
  if (!response?.ok) return false;
  const finalUrl = new URL(response.url);
  if (finalUrl.origin !== self.location.origin || finalUrl.pathname !== pathname) return false;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(normalizedRequest(pathname), response.clone());
  await trimRuntimeCache();
  return true;
}

async function refreshAppShell(pathname) {
  try {
    const response = await fetch(normalizedRequest(pathname));
    await cacheValidAppShell(pathname, response);
    return response;
  } catch {
    return null;
  }
}

async function appNavigation(pathname) {
  const cached = await caches.match(normalizedRequest(pathname));
  if (cached) return cached;
  const response = await refreshAppShell(pathname);
  return response || caches.match(normalizedRequest(POS_PATH)) || caches.match("/offline.html");
}

async function cacheFirstWithRefresh(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
        await trimRuntimeCache();
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("kasirkita-core-") && key !== CORE_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || !sameOrigin(request)) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    if (OFFLINE_ROUTES.has(url.pathname)) {
      event.respondWith(appNavigation(url.pathname));
      event.waitUntil(refreshAppShell(url.pathname));
      return;
    }
    return;
  }

  const cacheableAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    /\.(?:css|js|woff2?|png|webp|svg|ico)$/.test(url.pathname);

  if (cacheableAsset) event.respondWith(cacheFirstWithRefresh(request, event));
});

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "WARM_POS_SHELL") {
    event.waitUntil(refreshAppShell(POS_PATH));
    return;
  }
  if (type !== "CLEAR_PRIVATE_CACHE") return;

  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const keys = await cache.keys();
      await Promise.all(keys
        .filter((request) => OFFLINE_ROUTES.has(new URL(request.url).pathname))
        .map((request) => cache.delete(request)));
    })
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "kasirkita-sync-checkouts") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => clients.forEach((client) => client.postMessage({ type: "SYNC_OFFLINE_CHECKOUTS" })))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/admin", self.location.origin).toString();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        await existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
