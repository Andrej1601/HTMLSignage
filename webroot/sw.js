const STATIC_CACHE_PREFIX = 'signage-static-';
const FALLBACK_STATIC_CACHE = `${STATIC_CACHE_PREFIX}fallback`;
const DATA_CACHE_PREFIX = 'signage-data-';
const FALLBACK_DATA_CACHE = `${DATA_CACHE_PREFIX}fallback`;
const OFFLINE_URL = '/offline.html';
const MANIFEST_URL = '/api/cache-manifest.php';
const SETTINGS_URL = '/api/settings.php';

const DATA_URLS = new Set(['/api/schedule.php', '/api/settings.php']);

const STATIC_DESTINATIONS = new Set(['style', 'script', 'image', 'font', 'video', 'audio']);

let staticCacheName = FALLBACK_STATIC_CACHE;
let staticCacheReady = (async () => {
  try {
    const keys = await caches.keys();
    const candidates = keys.filter(key => key.startsWith(STATIC_CACHE_PREFIX));
    if (candidates.length > 0) {
      candidates.sort();
      staticCacheName = candidates[candidates.length - 1];
    }
  } catch (error) {
    console.error('[sw] Failed to inspect cache keys', error);
  }
  return staticCacheName;
})();

async function resolveStaticCacheName() {
  return staticCacheReady;
}

let dataCacheName = FALLBACK_DATA_CACHE;
let dataCacheInitialized = false;
let dataCacheReady = Promise.resolve(dataCacheName);

async function resolveDataCacheName() {
  if (!dataCacheInitialized) {
    await prepareDataCache();
  }
  return dataCacheReady;
}

async function fetchSettingsVersion() {
  const response = await fetch(SETTINGS_URL, { cache: 'no-store' });
  if (!response || !response.ok) {
    throw new Error(`settings-response-${response ? response.status : 'missing'}`);
  }
  let payload;
  try {
    payload = await response.clone().json();
  } catch (error) {
    throw new Error('settings-invalid-json');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('settings-invalid-payload');
  }
  const { version } = payload;
  if (typeof version === 'number' && Number.isFinite(version)) {
    return String(version);
  }
  if (typeof version === 'string' && version !== '') {
    return version;
  }
  throw new Error('settings-missing-version');
}

async function prepareDataCache() {
  dataCacheInitialized = true;
  dataCacheReady = (async () => {
    let version = null;
    try {
      version = await fetchSettingsVersion();
    } catch (error) {
      console.error('[sw] Unable to determine settings version', error);
    }
    const targetName = version ? `${DATA_CACHE_PREFIX}${version}` : FALLBACK_DATA_CACHE;
    dataCacheName = targetName;
    try {
      await caches.open(targetName);
    } catch (error) {
      console.error('[sw] Failed to open data cache', targetName, error);
    }
    return dataCacheName;
  })();
  return dataCacheReady;
}

async function fetchPrecacheManifest() {
  const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`manifest-response-${response.status}`);
  }
  const payload = await response.json();
  if (!payload || typeof payload !== 'object') {
    throw new Error('manifest-invalid-payload');
  }
  const { version, urls } = payload;
  if (typeof version !== 'string' || !Array.isArray(urls)) {
    throw new Error('manifest-missing-fields');
  }
  const normalizedUrls = urls.filter(url => typeof url === 'string' && url !== '');
  return { version, urls: normalizedUrls };
}

async function populateStaticCache(manifest) {
  const targetName = manifest ? `${STATIC_CACHE_PREFIX}${manifest.version}` : FALLBACK_STATIC_CACHE;
  staticCacheName = targetName;
  staticCacheReady = Promise.resolve(staticCacheName);
  const cache = await caches.open(staticCacheName);
  const urls = new Set([OFFLINE_URL]);
  if (manifest) {
    for (const url of manifest.urls) {
      urls.add(url);
    }
  }
  for (const url of urls) {
    try {
      await cache.add(url);
    } catch (error) {
      console.error('[sw] Failed to precache', url, error);
    }
  }
  return staticCacheName;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const manifest = await fetchPrecacheManifest();
      await populateStaticCache(manifest);
    } catch (error) {
      console.error('[sw] Unable to fetch precache manifest', error);
      await populateStaticCache(null);
    }
    await prepareDataCache();
  })());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const currentStatic = await resolveStaticCacheName();
    const currentData = await resolveDataCacheName();
    const keys = await caches.keys();
    const allowed = new Set([currentStatic, currentData]);
    if (currentStatic !== FALLBACK_STATIC_CACHE) {
      allowed.add(FALLBACK_STATIC_CACHE);
    }
    if (currentData !== FALLBACK_DATA_CACHE) {
      allowed.add(FALLBACK_DATA_CACHE);
    }
    await Promise.all(keys.filter(key => !allowed.has(key)).map(key => caches.delete(key)));
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

  if (DATA_URLS.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(await resolveDataCacheName());
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
        throw new Error('bad response');
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
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
      const cache = await caches.open(await resolveStaticCacheName());
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
    const cache = await caches.open(await resolveStaticCacheName());
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
