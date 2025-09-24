const CACHE_NAME = 'signage-static-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/assets/design.css',
  '/assets/responsive.css',
  '/assets/slideshow.js',
  OFFLINE_URL
];

const STATIC_DESTINATIONS = new Set(['style', 'script', 'image', 'font', 'video', 'audio']);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          return response;
        }
      } catch (error) {
        // ignore and fall through to cache lookup
      }
      const cache = await caches.open(CACHE_NAME);
      const offline = await cache.match(OFFLINE_URL);
      return offline || Response.error();
    })());
    return;
  }

  const destination = request.destination;
  if (!STATIC_DESTINATIONS.has(destination)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(request);
      if (!response || !response.ok) {
        return response;
      }
      await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (cached) {
        return cached;
      }
      throw error;
    }
  })());
});
