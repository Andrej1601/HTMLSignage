const STATIC_CACHE_PREFIX = 'signage-static-';
const FALLBACK_STATIC_CACHE = `${STATIC_CACHE_PREFIX}fallback`;
const DATA_CACHE_PREFIX = 'signage-data-';
const FALLBACK_DATA_CACHE = `${DATA_CACHE_PREFIX}fallback`;
const OFFLINE_URL = '/offline.html';
const MANIFEST_URL = '/api/cache-manifest.php';
const SETTINGS_URL = '/api/settings.php';
const SCHEDULE_URL = '/api/schedule.php';

const DATA_URLS = new Set([SCHEDULE_URL, SETTINGS_URL]);

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
let dataCacheSignatures = { settings: null, schedule: null };

async function resolveDataCacheName() {
  if (!dataCacheInitialized) {
    await prepareDataCache();
  }
  return dataCacheReady;
}

function normalizeVersionToken(token) {
  if (token === undefined || token === null) {
    return null;
  }
  if (typeof token === 'number') {
    if (!Number.isFinite(token)) {
      return null;
    }
    return String(token);
  }
  if (typeof token !== 'string') {
    return null;
  }
  let value = token.trim();
  if (value === '') {
    return null;
  }
  if (value.startsWith('W/')) {
    const weakValue = value.slice(2).trim().replace(/^"|"$/g, '');
    return weakValue ? `W/${weakValue}` : null;
  }
  value = value.replace(/^"|"$/g, '');
  return value === '' ? null : value;
}

function extractScheduleSignatureFromHeaders(headers) {
  if (!headers) {
    return null;
  }
  const signatureHeader = headers.get('X-Signage-Schedule-Signature');
  if (signatureHeader) {
    const normalized = normalizeVersionToken(signatureHeader);
    if (normalized) {
      return normalized;
    }
  }
  const etag = headers.get('ETag');
  if (etag) {
    const normalized = normalizeVersionToken(etag);
    if (normalized) {
      return normalized;
    }
  }
  const versionHeader = headers.get('X-Signage-Schedule-Version');
  if (versionHeader) {
    const normalized = normalizeVersionToken(versionHeader);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

async function readScheduleSignatureFromResponse(response) {
  const headerSignature = extractScheduleSignatureFromHeaders(response.headers);
  if (headerSignature) {
    return headerSignature;
  }
  try {
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const normalized = normalizeVersionToken(payload.version);
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    // ignore invalid json
  }
  return null;
}

async function readSettingsVersionFromResponse(response) {
  try {
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return normalizeVersionToken(payload.version);
  } catch (error) {
    return null;
  }
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
  const normalized = normalizeVersionToken(payload.version);
  if (normalized) {
    return normalized;
  }
  throw new Error('settings-missing-version');
}

async function fetchScheduleSignature() {
  try {
    const headResponse = await fetch(SCHEDULE_URL, { method: 'HEAD', cache: 'no-store' });
    if (headResponse && headResponse.ok) {
      const headerSignature = extractScheduleSignatureFromHeaders(headResponse.headers);
      if (headerSignature) {
        return headerSignature;
      }
    }
  } catch (error) {
    console.error('[sw] Failed to fetch schedule signature (HEAD)', error);
  }

  const response = await fetch(SCHEDULE_URL, { cache: 'no-store' });
  if (!response || !response.ok) {
    throw new Error(`schedule-response-${response ? response.status : 'missing'}`);
  }
  const signature = await readScheduleSignatureFromResponse(response.clone())
    || extractScheduleSignatureFromHeaders(response.headers);
  if (signature) {
    return signature;
  }
  throw new Error('schedule-missing-signature');
}

function buildDataCacheName(settingsVersion, scheduleSignature) {
  const parts = [];
  if (settingsVersion) {
    parts.push(`settings-${settingsVersion}`);
  }
  if (scheduleSignature) {
    parts.push(`schedule-${scheduleSignature}`);
  }
  if (parts.length === 0) {
    return FALLBACK_DATA_CACHE;
  }
  return `${DATA_CACHE_PREFIX}${parts.join('__')}`;
}

async function pruneDataCaches(activeName) {
  try {
    const keys = await caches.keys();
    const allowed = new Set([activeName, FALLBACK_DATA_CACHE]);
    await Promise.all(keys.filter(key => key.startsWith(DATA_CACHE_PREFIX) && !allowed.has(key)).map(key => caches.delete(key)));
  } catch (error) {
    console.error('[sw] Failed to prune data caches', error);
  }
}

async function prepareDataCache({ force = false, scheduleSignature, settingsVersion } = {}) {
  if (!force && dataCacheInitialized) {
    return dataCacheReady;
  }
  dataCacheInitialized = true;
  dataCacheReady = (async () => {
    let resolvedSettings = settingsVersion;
    let resolvedSchedule = scheduleSignature;

    if (resolvedSettings === undefined) {
      try {
        resolvedSettings = await fetchSettingsVersion();
      } catch (error) {
        console.error('[sw] Unable to determine settings version', error);
        resolvedSettings = null;
      }
    }
    if (resolvedSchedule === undefined) {
      try {
        resolvedSchedule = await fetchScheduleSignature();
      } catch (error) {
        console.error('[sw] Unable to determine schedule signature', error);
        resolvedSchedule = null;
      }
    }

    const normalizedSettings = normalizeVersionToken(resolvedSettings);
    const normalizedSchedule = normalizeVersionToken(resolvedSchedule);
    dataCacheSignatures = { settings: normalizedSettings, schedule: normalizedSchedule };

    const targetName = buildDataCacheName(normalizedSettings, normalizedSchedule);
    dataCacheName = targetName;
    try {
      await caches.open(targetName);
    } catch (error) {
      console.error('[sw] Failed to open data cache', targetName, error);
    }
    await pruneDataCaches(targetName);
    return dataCacheName;
  })();
  return dataCacheReady;
}

async function maybeRefreshDataCacheFromScheduleResponse(response) {
  const signature = await readScheduleSignatureFromResponse(response);
  if (!signature || signature === dataCacheSignatures.schedule) {
    return;
  }
  await prepareDataCache({
    force: true,
    scheduleSignature: signature,
    settingsVersion: dataCacheSignatures.settings,
  });
}

async function maybeRefreshDataCacheFromSettingsResponse(response) {
  const version = await readSettingsVersionFromResponse(response);
  if (!version || version === dataCacheSignatures.settings) {
    return;
  }
  await prepareDataCache({
    force: true,
    settingsVersion: version,
    scheduleSignature: dataCacheSignatures.schedule,
  });
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
    const isScheduleRequest = url.pathname === SCHEDULE_URL;
    const isSettingsRequest = url.pathname === SETTINGS_URL;
    event.respondWith((async () => {
      const initialCacheName = await resolveDataCacheName();
      const initialCache = await caches.open(initialCacheName);
      const cached = await initialCache.match(request);

      const revalidatePromise = (async () => {
        let response;
        try {
          response = await fetch(request, { cache: 'no-store' });
        } catch (error) {
          throw error;
        }
        if (!response || !response.ok) {
          throw new Error('bad response');
        }

        try {
          if (isScheduleRequest) {
            await maybeRefreshDataCacheFromScheduleResponse(response.clone());
          } else if (isSettingsRequest) {
            await maybeRefreshDataCacheFromSettingsResponse(response.clone());
          }
        } catch (metaError) {
          console.error('[sw] Failed to refresh data cache metadata', metaError);
        }

        const targetCache = await caches.open(await resolveDataCacheName());
        await targetCache.put(request, response.clone());
        return response;
      })();

      if (cached) {
        event.waitUntil(revalidatePromise.catch(error => {
          console.error('[sw] Data revalidation failed', error);
        }));
        return cached;
      }

      try {
        return await revalidatePromise;
      } catch (error) {
        const fallbackCache = await caches.open(await resolveDataCacheName());
        const fallback = await fallbackCache.match(request);
        if (fallback) {
          return fallback;
        }
        if (dataCacheName !== FALLBACK_DATA_CACHE) {
          const legacyFallback = await caches.open(FALLBACK_DATA_CACHE);
          const legacyCached = await legacyFallback.match(request);
          if (legacyCached) {
            return legacyCached;
          }
        }
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
