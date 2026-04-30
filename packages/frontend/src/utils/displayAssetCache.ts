const DISPLAY_ASSET_CACHE_NAME = 'htmlsignage-display-assets-v1';
const blobUrlRegistry = new Map<string, string>(); // url -> objectURL

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

export async function prefetchDisplayAssets(urls: string[]): Promise<void> {
  const uniqueUrls = Array.from(new Set(urls.filter(isCacheableUrl)));
  if (uniqueUrls.length === 0) return;

  await Promise.all(uniqueUrls.map((url) => cacheDisplayAsset(url).catch(() => {})));
}

export async function resolveCachedDisplayAssetUrl(url: string): Promise<string | null> {
  if (!isCacheableUrl(url)) return null;

  const cache = await openDisplayAssetCache();
  if (!cache) return null;

  const response = await cache.match(url);
  if (!response) return null;

  // Revoke previous blob URL for this URL to prevent memory leak
  const existingBlobUrl = blobUrlRegistry.get(url);
  if (existingBlobUrl) {
    URL.revokeObjectURL(existingBlobUrl);
    blobUrlRegistry.delete(url);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobUrlRegistry.set(url, objectUrl);
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
