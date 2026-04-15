import { useEffect, useRef } from 'react';
import { ENV_IS_DEV } from '@/config/env';
import { displayDevicesApi } from '@/services/displayApi';

/**
 * Sends periodic heartbeat signals to the backend for paired display devices.
 * Runs every 2 minutes when the device is paired and has a valid token.
 */
export function useDisplayHeartbeat(options: {
  isPreviewMode: boolean;
  deviceToken: string | null;
  deviceId: string | null;
  paired: boolean;
}) {
  const { isPreviewMode, deviceToken, deviceId, paired } = options;
  const heartbeatInFlightRef = useRef(false);

  useEffect(() => {
    if (isPreviewMode || !paired || !deviceId || !deviceToken) return;

    const sendHeartbeat = async () => {
      if (heartbeatInFlightRef.current) return;
      heartbeatInFlightRef.current = true;
      try {
        const response = await displayDevicesApi.sendHeartbeat(deviceId, deviceToken);
        if (response.ok && ENV_IS_DEV) {
          console.log('[Display] Heartbeat sent');
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('[Display] Heartbeat failed:', error);
        }
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 2 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [deviceToken, isPreviewMode, deviceId, paired]);
}
