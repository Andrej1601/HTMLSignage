import { useCallback, useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Media } from '@/types/media.types';
import { ENV_IS_DEV } from '@/config/env';
import {
  displayDevicesApi,
  displayScheduleApi,
  displaySettingsApi,
} from '@/services/displayApi';
import { migrateSettings } from '@/utils/slideshowMigration';
import {
  PREVIEW_CONFIG_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_REQUEST_READY_EVENT,
} from '@/components/Display/previewBridge';
import { clearDisplayAssetCache } from '@/utils/displayAssetCache';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import { getDefaultSettings, type Settings } from '@/types/settings.types';
import {
  clearDisplayClientStorage,
  DISPLAY_CACHED_SCHEDULE_KEY,
  DISPLAY_CACHED_SETTINGS_KEY,
  parsePreviewConfigPayload,
  readDisplayCachedValue,
  resolveDisplayIdentity,
  shouldUseFallbackDisplayConfig,
  writeDisplayCachedValue,
  type PreviewConfigMessage,
} from './displayClientRuntime.utils';
import { useDisplayPairing } from './useDisplayPairing';
import { useDisplayMediaPolling } from './useDisplayMediaPolling';
import { useDisplayHeartbeat } from './useDisplayHeartbeat';
import { useDisplayEventClock } from './useDisplayEventClock';

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
  pairingInfo: import('@/types/auth.types').PairingResponse | null;
  scheduleLoading: boolean;
  scheduleError: string | null;
  settingsLoading: boolean;
  settingsError: string | null;
  deviceToken: string | null;
}

export function useDisplayClientRuntime(isPreviewMode: boolean): DisplayClientRuntimeState {
  // ── Pairing ────────────────────────────────────────────────────────────────
  const { pairingInfo, deviceToken, isPairingLoading } = useDisplayPairing(isPreviewMode);

  // ── Media polling ──────────────────────────────────────────────────────────
  const mediaItems = useDisplayMediaPolling(deviceToken);

  // ── Display config state ───────────────────────────────────────────────────
  const [isDisplayConfigLoading, setIsDisplayConfigLoading] = useState(false);
  const [hasLoadedDeviceConfig, setHasLoadedDeviceConfig] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [hasPreviewPayload, setHasPreviewPayload] = useState(false);
  const [previewDeviceId, setPreviewDeviceId] = useState<string | null>(null);
  const [previewDeviceName, setPreviewDeviceName] = useState<string | null>(null);
  const [previewClockOverride, setPreviewClockOverride] = useState<number | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const pairedDeviceIdRef = useRef<string | null>(null);
  const displayConfigRefreshInFlightRef = useRef(false);
  const displayConfigRefreshQueueRef = useRef<{ deviceId: string; silent: boolean } | null>(null);
  const displayConfigRefreshVersionRef = useRef(0);

  // ── Event clock ────────────────────────────────────────────────────────────
  const eventClock = useDisplayEventClock(previewClockOverride);

  // ── Schedule & Settings state ──────────────────────────────────────────────
  const [localSchedule, setLocalSchedule] = useState<Schedule>(() => (
    readDisplayCachedValue<Schedule>(DISPLAY_CACHED_SCHEDULE_KEY) || createDefaultSchedule()
  ));
  const [localSettings, setLocalSettings] = useState<Settings>(() => (
    readDisplayCachedValue<Settings>(DISPLAY_CACHED_SETTINGS_KEY) || getDefaultSettings()
  ));
  const shouldUseFallbackConfigQueries = shouldUseFallbackDisplayConfig({
    isPreviewMode,
    paired: Boolean(pairingInfo?.paired),
    hasLoadedDeviceConfig,
  });

  const applySchedule = useCallback((schedule: Schedule, options?: { persist?: boolean }) => {
    setLocalSchedule(schedule);
    if (options?.persist !== false) {
      writeDisplayCachedValue(DISPLAY_CACHED_SCHEDULE_KEY, schedule);
    }
  }, []);

  const applySettings = useCallback((
    settings: Settings,
    options?: { persist?: boolean; cacheValue?: unknown },
  ) => {
    setLocalSettings(settings);
    if (options?.persist !== false) {
      writeDisplayCachedValue(
        DISPLAY_CACHED_SETTINGS_KEY,
        (options?.cacheValue ?? settings) as Settings,
      );
    }
  }, []);

  // ── Preview mode bridge ────────────────────────────────────────────────────
  const applyPreviewPayload = useCallback((payload: PreviewConfigMessage['payload']) => {
    const parsedPayload = parsePreviewConfigPayload(payload);
    if (!parsedPayload) return;

    if (parsedPayload.schedule) {
      applySchedule(parsedPayload.schedule, { persist: false });
      setHasPreviewPayload(true);
    }

    if (parsedPayload.settings) {
      // postMessage payload is structurally untyped (origin checked in handler);
      // migrateSettings tolerates Partial<Settings> and fills version + theme defaults.
      applySettings(
        migrateSettings(parsedPayload.settings as Partial<Settings>),
        { persist: false },
      );
      setHasPreviewPayload(true);
    }

    setPreviewDeviceId(parsedPayload.deviceId);
    setPreviewDeviceName(parsedPayload.deviceName);
    setPreviewClockOverride(parsedPayload.previewClock);
    setMaintenanceMode(parsedPayload.maintenanceMode);
  }, [applySchedule, applySettings]);

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
      applyPreviewPayload(message.payload);
    };

    window.addEventListener('message', handlePreviewMessage);
    notifyParentReady();

    return () => {
      window.removeEventListener('message', handlePreviewMessage);
    };
  }, [applyPreviewPayload, isPreviewMode]);

  useEffect(() => {
    if (!isPreviewMode) {
      setHasPreviewPayload(false);
      setPreviewDeviceId(null);
      setPreviewDeviceName(null);
      setPreviewClockOverride(null);
    }
  }, [isPreviewMode]);

  // ── Device display config refresh ──────────────────────────────────────────
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

        applySchedule(displayConfig.schedule);
        applySettings(
          migrateSettings(displayConfig.settings),
          { cacheValue: displayConfig.settings },
        );
        setMaintenanceMode(Boolean(displayConfig.maintenanceMode));
        setHasLoadedDeviceConfig(true);
        setScheduleError(null);
        setSettingsError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Display-Konfiguration konnte nicht geladen werden';
        setScheduleError(message);
        setSettingsError(message);
        if (ENV_IS_DEV) {
          console.error('[Display] Failed to load effective display config:', error);
        }
        const cachedSchedule = readDisplayCachedValue<Schedule>(DISPLAY_CACHED_SCHEDULE_KEY);
        const cachedSettings = readDisplayCachedValue<Settings>(DISPLAY_CACHED_SETTINGS_KEY);
        if (cachedSchedule) applySchedule(cachedSchedule, { persist: false });
        if (cachedSettings) {
          applySettings(migrateSettings(cachedSettings), { persist: false });
        }
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
  }, [applySchedule, applySettings, deviceToken]);

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

  // ── Fallback queries (when no device config) ──────────────────────────────
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
          applySchedule(schedule);
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
    applySchedule,
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
          applySettings(settings);
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
    applySettings,
    hasLoadedDeviceConfig,
    hasPreviewPayload,
    isPreviewMode,
    pairingInfo?.paired,
    shouldUseFallbackConfigQueries,
  ]);

  // ── WebSocket ──────────────────────────────────────────────────────────────
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
      applySchedule(data);
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
      applySettings(migrateSettings(data));
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
    subscribe('schedule', undefined, deviceToken);
    subscribe('settings', undefined, deviceToken);
    subscribe('device', deviceId, deviceToken);

    return () => {
      unsubscribe('schedule');
      unsubscribe('settings');
      unsubscribe('device', deviceId);
    };
  }, [deviceToken, isConnected, isPreviewMode, pairingInfo?.id, pairingInfo?.paired, subscribe, unsubscribe]);

  // ── Heartbeat ──────────────────────────────────────────────────────────────
  useDisplayHeartbeat({
    isPreviewMode,
    deviceToken,
    deviceId: pairingInfo?.id ?? null,
    paired: Boolean(pairingInfo?.paired),
  });

  // ── Identity resolution ────────────────────────────────────────────────────
  const { displayDeviceId, displayDeviceName } = resolveDisplayIdentity({
    isPreviewMode,
    previewDeviceId,
    previewDeviceName,
    pairingInfo,
  });

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
    scheduleError,
    settingsLoading,
    settingsError,
    deviceToken,
  };
}
