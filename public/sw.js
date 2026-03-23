const CACHE_NAME = "xpend-pwa-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );

      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (
    url.pathname.startsWith("/_next/") ||
    /\.(?:css|js|png|svg|jpg|jpeg|webp|avif|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function handleNavigationRequest(event) {
  const preloadResponse = await event.preloadResponse;
  if (preloadResponse) {
    return preloadResponse;
  }

  try {
    const networkResponse = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const fallbackResponse = await caches.match("/");
    if (fallbackResponse) {
      return fallbackResponse;
    }

    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Xpend</title><style>body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f9fafb;color:#111827;display:grid;place-items:center;min-height:100vh;padding:24px}.card{max-width:420px;background:#fff;border:1px solid #dbeafe;border-radius:20px;padding:24px;box-shadow:0 20px 45px rgba(37,99,235,.12)}h1{margin:0 0 12px;font-size:1.5rem}p{margin:0;color:#4b5563;line-height:1.6}</style></head><body><div class="card"><h1>You are offline</h1><p>Xpend needs a connection to refresh account data, but the app shell is still available. Reconnect and try again.</p></div></body></html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      cache.put(request, networkResponse.clone());
      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}
