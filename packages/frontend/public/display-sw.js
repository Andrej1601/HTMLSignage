/**
 * HTMLSignage Display Service Worker
 *
 * Caches the app shell (HTML, JS, CSS) so display clients can survive
 * brief network outages. Media assets are cached separately by
 * displayAssetCache.ts using the Cache API.
 *
 * Strategy: Network-first for navigation, stale-while-revalidate for assets.
 */

const CACHE_NAME = 'htmlsignage-display-shell-v1';
const SHELL_URLS = ['/', '/display'];

// Install: pre-cache the display HTML shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Only cache the display entry point
      cache.addAll(SHELL_URLS).catch(() => {
        // Non-fatal: shell will be cached on first navigation
      })
    )
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('htmlsignage-display-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip API requests, WebSocket upgrades, and cross-origin
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/uploads')) {
    return;
  }

  // Navigation requests (HTML): network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/display')))
    );
    return;
  }

  // JS/CSS assets: stale-while-revalidate
  if (url.pathname.match(/\/assets\/.*\.(js|css)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }
});
