/* Trell service worker — app-shell offline + safe static caching.
 *
 * Kept deliberately conservative so it can never serve stale app data:
 *   - only GET, same-origin
 *   - never touches /api/, auth routes, or RSC/payload requests
 *   - navigations: network first, cache fallback, then a friendly offline page
 *   - immutable build assets & images: stale-while-revalidate
 *
 * Bump CACHE_VERSION to invalidate old caches on deploy.
 */
const CACHE_VERSION = "trell-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGES_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = "/offline";

const PRECACHE = ["/offline", "/icons/pwa/icon-192.png", "/icons/pwa/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|css|js)$/i.test(url.pathname);
}

function isBypassed(url) {
  // Never cache or intercept data / auth / Next internals that carry state.
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/api/auth/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.pathname.startsWith("/_next/image") ||
    url.searchParams.has("_rsc")
  );
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || network || Response.error();
}

async function networkFirstPage(request) {
  // Dashboard pages are user-specific and data-driven: never cache the HTML,
  // just surface a branded offline page when the network is unavailable.
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isBypassed(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

// The install banner asks the page to focus a tab instead of opening a duplicate.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
