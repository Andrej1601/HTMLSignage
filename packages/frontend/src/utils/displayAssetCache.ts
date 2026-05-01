/**
 * Display-Asset-Cache mit zwei Schichten:
 *   1. CacheStorage (`htmlsignage-display-assets-v1`) — persistent
 *      auf der Disk des Kiosk-Geräts; survives Reloads.
 *   2. In-Memory-Blob-URL-Registry — die Object-URLs, die wir den
 *      Bildern/Videos im DOM geben, müssen wir später revoken,
 *      sonst hält der Browser die Bytes bis zum Tab-Close fest.
 *
 * Auf einem 24/7-Kiosk-Gerät rotiert der Saunameister wöchentlich neue
 * Slideshows ein. Ohne Eviction wachsen beide Schichten unbegrenzt:
 *   - blobUrlRegistry behält Einträge für jede URL, die je aufgelöst
 *     wurde — auch wenn die Slide längst gelöscht ist.
 *   - CacheStorage behält jedes je gefetchte Bild für immer.
 *
 * Strategie:
 *   - Blob-URL-Registry: LRU mit hartem Cap (`MAX_BLOB_URLS`). Beim
 *     Überschreiten wird der älteste Eintrag revoked.
 *   - CacheStorage: bei `prefetchDisplayAssets` werden alle Cache-
 *     Einträge entfernt, deren URL nicht in der aktuellen Asset-
 *     Liste vorkommt — das ist die natürliche Eviction-Stelle, weil
 *     der Caller die "aktuell relevanten" URLs ohnehin liefert.
 */
const DISPLAY_ASSET_CACHE_NAME = 'htmlsignage-display-assets-v1';

/** Max. gleichzeitig gehaltene Blob-URLs. Reicht typischerweise für
 *  alle Slides + 1-2 Generations Spielraum bei Slide-Wechseln.
 *  50 Einträge ≈ 50 MB Memory bei 1 MB-Bildern; auf Raspberry Pi
 *  mit 2 GB RAM ist das eine vernachlässigbare Obergrenze. */
const MAX_BLOB_URLS = 50;

/** url -> objectURL. `Map` bewahrt Insertion-Order — wir nutzen das
 *  als LRU: bei Zugriff (`resolveCachedDisplayAssetUrl`) wird der
 *  Eintrag delete+set, wandert also ans Ende. Der älteste Eintrag
 *  ist immer `Map#keys().next().value`. */
const blobUrlRegistry = new Map<string, string>();

function canUseCacheStorage(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

function isCacheableUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

async function openDisplayAssetCache(): Promise<Cache | null> {
  if (!canUseCacheStorage()) return null;
  return window.caches.open(DISPLAY_ASSET_CACHE_NAME);
}

async function cacheDisplayAsset(url: string): Promise<void> {
  if (!isCacheableUrl(url)) return;

  const cache = await openDisplayAssetCache();
  if (!cache) return;

  const existing = await cache.match(url);
  if (existing) return;

  const response = await fetch(url, {
    credentials: 'same-origin',
  });

  if (!response.ok) return;
  await cache.put(url, response.clone());
}

/** Entfernt alle Cache-Einträge, deren URL nicht mehr aktuell ist —
 *  die `keepUrls`-Liste markiert die "noch relevanten" Assets. */
async function evictStaleCacheEntries(keepUrls: Set<string>): Promise<void> {
  const cache = await openDisplayAssetCache();
  if (!cache) return;
  const requests = await cache.keys();
  await Promise.all(
    requests.map(async (req) => {
      if (!keepUrls.has(req.url)) {
        await cache.delete(req).catch(() => {});
      }
    }),
  );
}

/** Setzt einen Blob-URL-Eintrag und enforced den LRU-Cap. */
function rememberBlobUrl(url: string, blobUrl: string): void {
  blobUrlRegistry.set(url, blobUrl);
  while (blobUrlRegistry.size > MAX_BLOB_URLS) {
    const oldestKey = blobUrlRegistry.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestBlob = blobUrlRegistry.get(oldestKey);
    if (oldestBlob) URL.revokeObjectURL(oldestBlob);
    blobUrlRegistry.delete(oldestKey);
  }
}

export async function prefetchDisplayAssets(urls: string[]): Promise<void> {
  const uniqueUrls = Array.from(new Set(urls.filter(isCacheableUrl)));
  if (uniqueUrls.length === 0) {
    // Auch der Leer-Fall ist eine Eviction-Chance — wenn keine Assets
    // mehr aktiv sind, leeren wir den Disk-Cache.
    await evictStaleCacheEntries(new Set());
    return;
  }

  await Promise.all(uniqueUrls.map((url) => cacheDisplayAsset(url).catch(() => {})));
  // Disk-Cache aufräumen: alles, was nicht mehr in der aktuellen
  // Asset-Liste ist, fliegt raus. Saunameister rotieren wöchentlich
  // Slideshows — sonst akkumulieren wir alte Banners ad infinitum.
  await evictStaleCacheEntries(new Set(uniqueUrls)).catch(() => {});
}

export async function resolveCachedDisplayAssetUrl(url: string): Promise<string | null> {
  if (!isCacheableUrl(url)) return null;

  const cache = await openDisplayAssetCache();
  if (!cache) return null;

  const response = await cache.match(url);
  if (!response) return null;

  // Bestehende Blob-URL für dieselbe Source revoken — sonst leakt
  // jeder Re-Use einen weiteren Object-URL.
  const existingBlobUrl = blobUrlRegistry.get(url);
  if (existingBlobUrl) {
    URL.revokeObjectURL(existingBlobUrl);
    blobUrlRegistry.delete(url);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  rememberBlobUrl(url, objectUrl);
  return objectUrl;
}

/** Revoke the blob URL for a cached asset. Call when the asset is no longer displayed. */
export function revokeCachedDisplayAssetUrl(url: string): void {
  const blobUrl = blobUrlRegistry.get(url);
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrlRegistry.delete(url);
  }
}

export async function clearDisplayAssetCache(): Promise<void> {
  // Revoke all tracked blob URLs
  for (const [, blobUrl] of blobUrlRegistry) {
    URL.revokeObjectURL(blobUrl);
  }
  blobUrlRegistry.clear();

  if (!canUseCacheStorage()) return;
  await window.caches.delete(DISPLAY_ASSET_CACHE_NAME).catch(() => {});
}
