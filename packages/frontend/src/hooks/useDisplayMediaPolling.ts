import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ENV_IS_DEV } from '@/config/env';
import { displayMediaApi } from '@/services/displayApi';
import type { Media } from '@/types/media.types';
import {
  areDisplayMediaListsEqual,
  DISPLAY_CACHED_MEDIA_KEY,
  readDisplayCachedValue,
  writeDisplayCachedValue,
} from './displayClientRuntime.utils';

export interface DisplayMediaPolling {
  media: Media[];
  /** Forces an immediate media re-fetch — wired to the `media:updated` WS event. */
  refresh: () => void;
}

/**
 * Keeps the display's media list fresh. The canonical freshness signal is the
 * `media:updated` WebSocket event (call `refresh`); the interval below is only
 * a long safety net for missed events or a dropped socket. Caches to
 * localStorage and falls back to the cached list on first render.
 */
export function useDisplayMediaPolling(deviceToken: string | null): DisplayMediaPolling {
  const cachedMedia = useMemo(
    () => readDisplayCachedValue<Media[]>(DISPLAY_CACHED_MEDIA_KEY) || [],
    [],
  );
  const [mediaItems, setMediaItems] = useState<Media[]>(() => cachedMedia);
  // Always points at the latest loader closure so `refresh` stays stable while
  // still fetching with the current device token.
  const refreshRef = useRef<() => void>(() => {});

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

    refreshRef.current = () => { void loadMedia(); };
    void loadMedia();

    // WS `media:updated` drives freshness; this long poll only recovers from
    // missed events / dropped sockets (down from the previous 5-minute poll).
    const interval = window.setInterval(() => {
      void loadMedia();
    }, 30 * 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [deviceToken]);

  const refresh = useCallback(() => {
    refreshRef.current();
  }, []);

  return { media: mediaItems, refresh };
}
