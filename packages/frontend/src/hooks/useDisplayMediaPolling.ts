import { useEffect, useMemo, useState } from 'react';
import { ENV_IS_DEV } from '@/config/env';
import { displayMediaApi } from '@/services/displayApi';
import type { Media } from '@/types/media.types';
import {
  areDisplayMediaListsEqual,
  DISPLAY_CACHED_MEDIA_KEY,
  readDisplayCachedValue,
  writeDisplayCachedValue,
} from './displayClientRuntime.utils';

/**
 * Polls the media list every 5 minutes and caches it in localStorage.
 * Falls back to the cached list on first render.
 */
export function useDisplayMediaPolling(deviceToken: string | null): Media[] {
  const cachedMedia = useMemo(
    () => readDisplayCachedValue<Media[]>(DISPLAY_CACHED_MEDIA_KEY) || [],
    [],
  );
  const [mediaItems, setMediaItems] = useState<Media[]>(() => cachedMedia);

  useEffect(() => {
    let isMounted = true;

    const loadMedia = async () => {
      try {
        const data = await displayMediaApi.getMedia(deviceToken ?? undefined);
        if (!isMounted || data.length === 0) return;
        setMediaItems((prev) => (areDisplayMediaListsEqual(prev, data) ? prev : data));
        writeDisplayCachedValue(DISPLAY_CACHED_MEDIA_KEY, data);
      } catch (error) {
        if (ENV_IS_DEV) {
          console.warn('[Display] Media preload failed:', error);
        }
      }
    };

    void loadMedia();
    const interval = window.setInterval(() => {
      void loadMedia();
    }, 5 * 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [deviceToken]);

  return mediaItems;
}
