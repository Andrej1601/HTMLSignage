import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { PairingResponse } from '@/types/auth.types';
import type { Media } from '@/types/media.types';
import { ENV_IS_DEV } from '@/config/env';
import {
  displayDevicesApi,
  displayMediaApi,
  displayScheduleApi,
  displaySettingsApi,
} from '@/services/displayApi';
import { migrateSettings } from '@/utils/slideshowMigration';
import {
  PREVIEW_CONFIG_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_REQUEST_READY_EVENT,
} from '@/components/Display/previewBridge';
import { isPlainRecord } from '@/utils/objectUtils';
import { clearDisplayAssetCache } from '@/utils/displayAssetCache';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import { getDefaultSettings, type Settings } from '@/types/settings.types';

const DEVICE_TOKEN_STORAGE_KEY = 'device_auth_token';
const BROWSER_ID_STORAGE_KEY = 'browserId';
const DISPLAY_CACHED_SCHEDULE_KEY = 'display_cached_schedule';
const DISPLAY_CACHED_SETTINGS_KEY = 'display_cached_settings';
const DISPLAY_CACHED_MEDIA_KEY = 'display_cached_media';

interface PreviewConfigMessage {
  type: string;
  payload?: {
    schedule?: unknown;
    settings?: unknown;
    deviceId?: unknown;
    deviceName?: unknown;
    previewAt?: unknown;
    maintenanceMode?: unknown;
  };
}

export interface DisplayClientRuntimeState {
  displayDeviceId: string | null;
  displayDeviceName: string | null;
  eventClock: number;
  isConnected: boolean;
  isDisplayConfigLoading: boolean;
  isPairingLoading: boolean;
  hasLoadedDeviceConfig: boolean;
  maintenanceMode: boolean;
  localSchedule: Schedule;
  localSettings: Settings;
  mediaItems: Media[];
  pairingInfo: PairingResponse | null;
  scheduleLoading: boolean;
  settingsLoading: boolean;
  deviceToken: string | null;
}

function generateBrowserId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readCachedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeCachedValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

function clearDisplayClientStorage(): void {
  localStorage.removeItem(DISPLAY_CACHED_SCHEDULE_KEY);
  localStorage.removeItem(DISPLAY_CACHED_SETTINGS_KEY);
  localStorage.removeItem(DISPLAY_CACHED_MEDIA_KEY);
}

function areMediaListsEqual(left: Media[], right: Media[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const other = right[index];
    return (
      item?.id === other?.id &&
      item?.updatedAt === other?.updatedAt &&
      item?.filename === other?.filename
    );
  });
}

export function useDisplayClientRuntime(isPreviewMode: boolean): DisplayClientRuntimeState {
  const [browserId] = useState(() => {
    let id = localStorage.getItem(BROWSER_ID_STORAGE_KEY);
    if (!id) {
      id = generateBrowserId();
      localStorage.setItem(BROWSER_ID_STORAGE_KEY, id);
    }
    return id;
  });
  const [pairingInfo, setPairingInfo] = useState<PairingResponse | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(
    () => localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY),
  );
  const [isPairingLoading, setIsPairingLoading] = useState(true);
  const [isDisplayConfigLoading, setIsDisplayConfigLoading] = useState(false);
  const [hasLoadedDeviceConfig, setHasLoadedDeviceConfig] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [hasPreviewPayload, setHasPreviewPayload] = useState(false);
  const [previewDeviceId, setPreviewDeviceId] = useState<string | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState<string | null>(null);
  const [previewClockOverride, setPreviewClockOverride] = useState<number | null>(null);
  const [eventClock, setEventClock] = useState(() => Date.now());
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);

  const pairedDeviceIdRef = useRef<string | null>(null);
  const displayConfigRefreshInFlightRef = useRef(false);
  const displayConfigRefreshQueueRef = useRef<{ deviceId: string; silent: boolean } | null>(null);
  const displayConfigRefreshVersionRef = useRef(0);

  const cachedMedia = useMemo(
    () => readCachedValue<Media[]>(DISPLAY_CACHED_MEDIA_KEY) || [],
    [],
  );
  const [mediaItems, setMediaItems] = useState<Media[]>(() => cachedMedia);

  const [localSchedule, setLocalSchedule] = useState<Schedule>(() => (
    readCachedValue<Schedule>(DISPLAY_CACHED_SCHEDULE_KEY) || createDefaultSchedule()
  ));
  const [localSettings, setLocalSettings] = useState<Settings>(() => (
    readCachedValue<Settings>(DISPLAY_CACHED_SETTINGS_KEY) || getDefaultSettings()
  ));
  const shouldUseFallbackConfigQueries = isPreviewMode || !pairingInfo?.paired || !hasLoadedDeviceConfig;

  useEffect(() => {
    let isMounted = true;

    const loadMedia = async () => {
      try {
        const data = await displayMediaApi.getMedia();
        if (!isMounted || data.length === 0) return;
        setMediaItems((prev) => (areMediaListsEqual(prev, data) ? prev : data));
        writeCachedValue(DISPLAY_CACHED_MEDIA_KEY, data);
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
  }, []);

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

  const refreshDeviceDisplayConfig = useCallback(async (deviceId: string, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    const requestVersion = ++displayConfigRefreshVersionRef.current;

    if (displayConfigRefreshInFlightRef.current) {
      const queued = displayConfigRefreshQueueRef.current;
      displayConfigRefreshQueueRef.current = {
        deviceId,
        silent: queued ? queued.silent && silent : silent,
      };
      return;
    }

    displayConfigRefreshInFlightRef.current = true;
    if (!silent) setIsDisplayConfigLoading(true);

    try {
      const displayConfig = await displayDevicesApi.getDisplayConfig(deviceId, deviceToken || undefined);
      if (requestVersion !== displayConfigRefreshVersionRef.current) {
        return;
      }

      setLocalSchedule(displayConfig.schedule);
      setLocalSettings(migrateSettings(displayConfig.settings));
      setMaintenanceMode(Boolean(displayConfig.maintenanceMode));
      writeCachedValue(DISPLAY_CACHED_SCHEDULE_KEY, displayConfig.schedule);
      writeCachedValue(DISPLAY_CACHED_SETTINGS_KEY, displayConfig.settings);
      setHasLoadedDeviceConfig(true);
    } catch (error) {
      if (ENV_IS_DEV) {
        console.error('[Display] Failed to load effective display config:', error);
      }
      const cachedSchedule = readCachedValue<Schedule>(DISPLAY_CACHED_SCHEDULE_KEY);
      const cachedSettings = readCachedValue<Settings>(DISPLAY_CACHED_SETTINGS_KEY);
      if (cachedSchedule) setLocalSchedule(cachedSchedule);
      if (cachedSettings) setLocalSettings(migrateSettings(cachedSettings));
      setHasLoadedDeviceConfig(Boolean(cachedSchedule || cachedSettings));
    } finally {
      displayConfigRefreshInFlightRef.current = false;
      if (!silent) setIsDisplayConfigLoading(false);

      const queued = displayConfigRefreshQueueRef.current;
      displayConfigRefreshQueueRef.current = null;
      if (queued && pairedDeviceIdRef.current === queued.deviceId) {
        void refreshDeviceDisplayConfig(queued.deviceId, { silent: queued.silent });
      }
    }
  }, [deviceToken]);

  useEffect(() => {
    if (!isPreviewMode) return;

    const notifyParentReady = () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: PREVIEW_READY_EVENT }, window.location.origin);
      }
    };

    const handlePreviewMessage = (event: MessageEvent<PreviewConfigMessage>) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || typeof message.type !== 'string') return;

      if (message.type === PREVIEW_REQUEST_READY_EVENT) {
        notifyParentReady();
        return;
      }

      if (message.type !== PREVIEW_CONFIG_EVENT) return;

      const payload = message.payload;
      if (!payload) return;

      const incomingSchedule = payload.schedule;
      if (
        isPlainRecord(incomingSchedule) &&
        typeof incomingSchedule.version === 'number' &&
        isPlainRecord(incomingSchedule.presets) &&
        typeof incomingSchedule.autoPlay === 'boolean'
      ) {
        setLocalSchedule(incomingSchedule as unknown as Schedule);
        setHasPreviewPayload(true);
      }

      const incomingSettings = payload.settings;
      if (isPlainRecord(incomingSettings)) {
        setLocalSettings(migrateSettings(incomingSettings as unknown as Settings));
        setHasPreviewPayload(true);
      }

      setPreviewDeviceId(typeof payload.deviceId === 'string' && payload.deviceId.trim() !== '' ? payload.deviceId : null);
      setPreviewDeviceName(
        typeof payload.deviceName === 'string' && payload.deviceName.trim() !== ''
          ? payload.deviceName
          : null,
      );
      const previewAtRaw = typeof payload.previewAt === 'string' ? payload.previewAt : '';
      const previewAtTimestamp = previewAtRaw ? Date.parse(previewAtRaw) : Number.NaN;
      const nextPreviewClock = Number.isFinite(previewAtTimestamp) ? previewAtTimestamp : null;
      setPreviewClockOverride(nextPreviewClock);
      setEventClock(nextPreviewClock ?? Date.now());
      setMaintenanceMode(payload.maintenanceMode === true);
    };

    window.addEventListener('message', handlePreviewMessage);
    notifyParentReady();

    return () => {
      window.removeEventListener('message', handlePreviewMessage);
    };
  }, [isPreviewMode]);

  useEffect(() => {
    if (!isPreviewMode) {
      setHasPreviewPayload(false);
      setPreviewDeviceId(null);
      setPreviewDeviceName(null);
      setPreviewClockOverride(null);
    }
  }, [isPreviewMode]);

  useEffect(() => {
    if (isPreviewMode) return;

    const pairedDeviceId = pairingInfo?.paired ? pairingInfo.id : null;
    pairedDeviceIdRef.current = pairedDeviceId;

    if (!pairedDeviceId || !deviceToken) {
      setHasLoadedDeviceConfig(false);
      setMaintenanceMode(false);
      return;
    }

    void refreshDeviceDisplayConfig(pairedDeviceId);
  }, [deviceToken, isPreviewMode, pairingInfo?.id, pairingInfo?.paired, refreshDeviceDisplayConfig]);

  useEffect(() => {
    if (!shouldUseFallbackConfigQueries) {
      setScheduleLoading(false);
      return;
    }

    let isMounted = true;
    setScheduleLoading(true);

    const loadSchedule = async () => {
      try {
        const schedule = await displayScheduleApi.getSchedule();
        if (!isMounted) return;
        if (isPreviewMode && hasPreviewPayload) return;
        if (!pairingInfo?.paired || !hasLoadedDeviceConfig) {
          setLocalSchedule(schedule);
          writeCachedValue(DISPLAY_CACHED_SCHEDULE_KEY, schedule);
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.warn('[Display] Fallback schedule load failed:', error);
        }
      } finally {
        if (isMounted) {
          setScheduleLoading(false);
        }
      }
    };

    void loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [
    hasLoadedDeviceConfig,
    hasPreviewPayload,
    isPreviewMode,
    pairingInfo?.paired,
    shouldUseFallbackConfigQueries,
  ]);

  useEffect(() => {
    if (!shouldUseFallbackConfigQueries) {
      setSettingsLoading(false);
      return;
    }

    let isMounted = true;
    setSettingsLoading(true);

    const loadSettings = async () => {
      try {
        const settings = migrateSettings(await displaySettingsApi.getSettings());
        if (!isMounted) return;
        if (isPreviewMode && hasPreviewPayload) return;
        if (!pairingInfo?.paired || !hasLoadedDeviceConfig) {
          setLocalSettings(settings);
          writeCachedValue(DISPLAY_CACHED_SETTINGS_KEY, settings);
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.warn('[Display] Fallback settings load failed:', error);
        }
      } finally {
        if (isMounted) {
          setSettingsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [
    hasLoadedDeviceConfig,
    hasPreviewPayload,
    isPreviewMode,
    pairingInfo?.paired,
    shouldUseFallbackConfigQueries,
  ]);

  const { isConnected, subscribe, unsubscribe } = useWebSocket({
    autoConnect: !isPreviewMode && Boolean(pairingInfo?.paired && pairingInfo?.id && deviceToken),
    onScheduleUpdate: (data) => {
      if (ENV_IS_DEV) {
        console.log('[Display] Schedule updated via WebSocket');
      }
      const deviceId = pairedDeviceIdRef.current;
      if (deviceId) {
        void refreshDeviceDisplayConfig(deviceId, { silent: true });
        return;
      }
      setLocalSchedule(data);
      writeCachedValue(DISPLAY_CACHED_SCHEDULE_KEY, data);
    },
    onSettingsUpdate: (data) => {
      if (ENV_IS_DEV) {
        console.log('[Display] Settings updated via WebSocket');
      }
      const deviceId = pairedDeviceIdRef.current;
      if (deviceId) {
        void refreshDeviceDisplayConfig(deviceId, { silent: true });
        return;
      }
      const migrated = migrateSettings(data);
      setLocalSettings(migrated);
      writeCachedValue(DISPLAY_CACHED_SETTINGS_KEY, migrated);
    },
    onDeviceUpdate: (data) => {
      const deviceId = pairedDeviceIdRef.current;
      if (!deviceId) return;

      const updatedDeviceId = typeof data.id === 'string' ? data.id : null;
      if (updatedDeviceId && updatedDeviceId !== deviceId) return;

      void refreshDeviceDisplayConfig(deviceId, { silent: true });
    },
    onDeviceCommand: (command) => {
      if (ENV_IS_DEV) {
        console.log('[Display] Command received:', command);
      }
      if (command === 'reload' || command === 'restart') {
        window.location.reload();
      }
      if (command === 'clear-cache') {
        void clearDisplayAssetCache().finally(() => {
          clearDisplayClientStorage();
          window.location.reload();
        });
      }
    },
  });

  useEffect(() => {
    if (isPreviewMode || !isConnected || !pairingInfo?.paired || !pairingInfo?.id || !deviceToken) {
      return;
    }

    const deviceId = pairingInfo.id;
    subscribe('schedule');
    subscribe('settings');
    subscribe('device', deviceId, deviceToken);

    return () => {
      unsubscribe('schedule');
      unsubscribe('settings');
      unsubscribe('device', deviceId);
    };
  }, [deviceToken, isConnected, isPreviewMode, pairingInfo?.id, pairingInfo?.paired, subscribe, unsubscribe]);

  useEffect(() => {
    if (isPreviewMode || !pairingInfo?.paired || !pairingInfo?.id || !deviceToken) return;

    const sendHeartbeat = async () => {
      try {
        const response = await displayDevicesApi.sendHeartbeat(pairingInfo.id, deviceToken);
        if (response.ok && ENV_IS_DEV) {
          console.log('[Display] Heartbeat sent');
        }
      } catch (error) {
        if (ENV_IS_DEV) {
          console.error('[Display] Heartbeat failed:', error);
        }
      }
    };

    void sendHeartbeat();
    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 2 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [deviceToken, isPreviewMode, pairingInfo?.id, pairingInfo?.paired]);

  useEffect(() => {
    if (previewClockOverride !== null) {
      setEventClock(previewClockOverride);
      return;
    }

    const interval = window.setInterval(() => setEventClock(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [previewClockOverride]);

  const displayDeviceId = isPreviewMode
    ? previewDeviceId
    : pairingInfo?.paired
      ? pairingInfo.id
      : null;
  const displayDeviceName = isPreviewMode
    ? previewDeviceName
    : pairingInfo?.paired
      ? (pairingInfo.name || null)
      : null;

  return {
    displayDeviceId,
    displayDeviceName,
    eventClock,
    isConnected,
    isDisplayConfigLoading,
    isPairingLoading,
    hasLoadedDeviceConfig,
    maintenanceMode,
    localSchedule,
    localSettings,
    mediaItems,
    pairingInfo,
    scheduleLoading,
    settingsLoading,
    deviceToken,
  };
}
