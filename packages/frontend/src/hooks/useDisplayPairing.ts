import { useEffect, useState } from 'react';
import { ENV_IS_DEV } from '@/config/env';
import { displayDevicesApi } from '@/services/displayApi';
import type { PairingResponse } from '@/types/auth.types';
import {
  BROWSER_ID_STORAGE_KEY,
  DEVICE_TOKEN_STORAGE_KEY,
  generateDisplayBrowserId,
} from './displayClientRuntime.utils';

export interface DisplayPairingState {
  browserId: string;
  pairingInfo: PairingResponse | null;
  deviceToken: string | null;
  isPairingLoading: boolean;
}

/**
 * Manages the display device pairing flow.
 * Generates a browserId, polls for pairing status, and stores the device token.
 */
export function useDisplayPairing(isPreviewMode: boolean): DisplayPairingState {
  const [browserId] = useState(() => {
    let id = localStorage.getItem(BROWSER_ID_STORAGE_KEY);
    if (!id) {
      id = generateDisplayBrowserId();
      localStorage.setItem(BROWSER_ID_STORAGE_KEY, id);
    }
    return id;
  });
  const [pairingInfo, setPairingInfo] = useState<PairingResponse | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(
    () => localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY),
  );
  const [isPairingLoading, setIsPairingLoading] = useState(true);

  useEffect(() => {
    if (isPreviewMode) {
      setIsPairingLoading(false);
      return;
    }

    let isMounted = true;

    const checkPairing = async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent && isMounted) setIsPairingLoading(true);

      try {
        const data = await displayDevicesApi.requestPairing(browserId);

        if (typeof data.deviceToken === 'string' && data.deviceToken.trim() !== '') {
          localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, data.deviceToken);
          if (isMounted) setDeviceToken(data.deviceToken);
        }

        if (isMounted) {
          setPairingInfo((prev) => {
            if (
              prev &&
              prev.id === data.id &&
              prev.paired === data.paired &&
              prev.pairingCode === data.pairingCode &&
              prev.name === data.name
            ) {
              return prev;
            }

            return data;
          });
        }
      } catch (error) {
        if (!silent && isMounted) {
          console.warn('[Display] Pairing request failed', error);
        }
        if (ENV_IS_DEV) {
          console.error('[Display] Pairing check failed:', error);
        }
      } finally {
        if (!silent && isMounted) setIsPairingLoading(false);
      }
    };

    void checkPairing({ silent: false });

    const interval = pairingInfo?.paired
      ? null
      : window.setInterval(() => {
          void checkPairing({ silent: true });
        }, 30_000);

    return () => {
      isMounted = false;
      if (interval) window.clearInterval(interval);
    };
  }, [browserId, isPreviewMode, pairingInfo?.paired]);

  return { browserId, pairingInfo, deviceToken, isPairingLoading };
}
