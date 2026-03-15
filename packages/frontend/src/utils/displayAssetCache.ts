const DISPLAY_ASSET_CACHE_NAME = 'htmlsignage-display-assets-v1';

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
    cache: 'no-store',
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

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function clearDisplayAssetCache(): Promise<void> {
  if (!canUseCacheStorage()) return;
  await window.caches.delete(DISPLAY_ASSET_CACHE_NAME).catch(() => {});
}
