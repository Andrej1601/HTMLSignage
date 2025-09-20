const CACHE_NAME = 'signage-static-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  '/assets/design.css',
  '/assets/responsive.css',
  '/assets/slideshow.js',
  OFFLINE_URL
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const req = evt.request;
  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
  const dest = req.destination;
  if (['style','script','image','font','video','audio'].includes(dest)) {
    evt.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return resp;
        });
      })
    );
  }
});
