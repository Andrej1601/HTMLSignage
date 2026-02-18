import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSlideshow } from '@/hooks/useSlideshow';
import { OverviewSlide } from '@/components/Display/OverviewSlide';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { ScheduleGridSlide } from '@/components/Display/ScheduleGridSlide';
import { TimelineScheduleSlide } from '@/components/Display/TimelineScheduleSlide';
import { SaunaDetailDashboard } from '@/components/Display/SaunaDetailDashboard';
import { SlideTransition } from '@/components/Display/SlideTransition';
import { WellnessBottomPanel } from '@/components/Display/WellnessBottomPanel';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';
import {
  generateDashboardColors,
  getActiveEvent,
  getColorPalette,
  getDefaultSettings,
  type AudioSettings,
  type ColorPaletteName,
  type Settings,
  type ThemeColors,
} from '@/types/settings.types';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import type { PairingResponse } from '@/types/auth.types';
import type { LayoutType, SlideConfig, Zone } from '@/types/slideshow.types';
import { API_URL, ENV_IS_DEV } from '@/config/env';
import { devicesApi } from '@/services/api';
import { migrateSettings } from '@/utils/slideshowMigration';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  PREVIEW_CONFIG_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_REQUEST_READY_EVENT,
} from '@/components/Display/previewBridge';

// Generate a unique browser ID (UUID v4)
function generateBrowserId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SUPPORTED_LAYOUTS: LayoutType[] = ['split-view', 'full-rotation', 'triple-view', 'grid-2x2'];

function normalizeLayout(layout: unknown): LayoutType {
  return SUPPORTED_LAYOUTS.includes(layout as LayoutType)
    ? (layout as LayoutType)
    : 'split-view';
}

function isMediaSlide(slide: SlideConfig | null | undefined): boolean {
  return Boolean(slide && typeof slide.type === 'string' && slide.type.startsWith('media-'));
}

function needsModernSlidePadding(isModernDesign: boolean, slide: SlideConfig | null | undefined): boolean {
  if (!isModernDesign || !slide) return false;
  return isMediaSlide(slide) || slide.type === 'infos' || slide.type === 'events';
}

interface PreviewConfigMessage {
  type: string;
  payload?: {
    schedule?: unknown;
    settings?: unknown;
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainRecord(value) && isPlainRecord(merged[key])) {
      merged[key] = deepMergeRecords(merged[key] as Record<string, unknown>, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function normalizeAudio(raw: unknown): AudioSettings {
  const value = isPlainRecord(raw) ? raw : {};
  const volume = typeof value.volume === 'number' && Number.isFinite(value.volume)
    ? Math.max(0, Math.min(1, value.volume))
    : 0.5;

  return {
    enabled: Boolean(value.enabled),
    src: typeof value.src === 'string' && value.src.trim().length > 0 ? value.src : undefined,
    mediaId: typeof value.mediaId === 'string' && value.mediaId.trim().length > 0 ? value.mediaId : undefined,
    volume,
    loop: value.loop !== false,
  };
}

export function DisplayClientPage() {
  const location = useLocation();
  const isPreviewMode = useMemo(
    () => new URLSearchParams(location.search).get('preview') === '1',
    [location.search]
  );

  // Get or create unique browser ID (persists across page reloads)
  const [browserId] = useState(() => {
    let id = localStorage.getItem('browserId');
    if (!id) {
      id = generateBrowserId();
      localStorage.setItem('browserId', id);
    }
    return id;
  });

  const [pairingInfo, setPairingInfo] = useState<PairingResponse | null>(null);
  const [isPairingLoading, setIsPairingLoading] = useState(true);
  const [isDisplayConfigLoading, setIsDisplayConfigLoading] = useState(false);
  const [hasLoadedDeviceConfig, setHasLoadedDeviceConfig] = useState(false);
  const [hasPreviewPayload, setHasPreviewPayload] = useState(false);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const pairedDeviceIdRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { schedule, isLoading: scheduleLoading } = useSchedule();
  const { settings: fetchedSettings, isLoading: settingsLoading } = useSettings();

  const [localSchedule, setLocalSchedule] = useState(schedule || createDefaultSchedule());
  const [localSettings, setLocalSettings] = useState(fetchedSettings || getDefaultSettings());
  const [eventClock, setEventClock] = useState(() => Date.now());

  // Check pairing status
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
        const response = await fetch(`${API_URL}/api/devices/request-pairing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ browserId }),
        });

        if (response.ok) {
          const data: PairingResponse = await response.json();
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
        }
      } catch (error) {
        console.error('[Display] Pairing check failed:', error);
      } finally {
        if (!silent && isMounted) setIsPairingLoading(false);
      }
    };

    // First load: show a blocking loading state.
    checkPairing({ silent: false });

    // Re-check pairing every 10 seconds
    const interval = setInterval(() => checkPairing({ silent: true }), 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [browserId, isPreviewMode]);

  const refreshDeviceDisplayConfig = useCallback(async (deviceId: string, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setIsDisplayConfigLoading(true);

    try {
      const displayConfig = await devicesApi.getDisplayConfig(deviceId);
      setLocalSchedule(displayConfig.schedule);
      setLocalSettings(migrateSettings(displayConfig.settings));
      setHasLoadedDeviceConfig(true);
    } catch (error) {
      console.error('[Display] Failed to load effective display config:', error);
      setHasLoadedDeviceConfig(false);
    } finally {
      if (!silent) setIsDisplayConfigLoading(false);
    }
  }, []);

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
    }
  }, [isPreviewMode]);

  useEffect(() => {
    if (isPreviewMode) return;

    const pairedDeviceId = pairingInfo?.paired ? pairingInfo.id : null;
    pairedDeviceIdRef.current = pairedDeviceId;

    if (!pairedDeviceId) {
      setHasLoadedDeviceConfig(false);
      return;
    }

    refreshDeviceDisplayConfig(pairedDeviceId);
  }, [pairingInfo?.id, pairingInfo?.paired, refreshDeviceDisplayConfig, isPreviewMode]);

  // Update local state when global data is fetched (fallback while no paired device config is loaded yet)
  useEffect(() => {
    if (!schedule) return;
    if (isPreviewMode && hasPreviewPayload) return;
    if (!pairingInfo?.paired || !hasLoadedDeviceConfig) {
      setLocalSchedule(schedule);
    }
  }, [schedule, pairingInfo?.paired, hasLoadedDeviceConfig, hasPreviewPayload, isPreviewMode]);

  useEffect(() => {
    if (!fetchedSettings) return;
    if (isPreviewMode && hasPreviewPayload) return;
    if (!pairingInfo?.paired || !hasLoadedDeviceConfig) {
      setLocalSettings(fetchedSettings);
    }
  }, [fetchedSettings, pairingInfo?.paired, hasLoadedDeviceConfig, hasPreviewPayload, isPreviewMode]);

  // WebSocket for real-time updates
  const { isConnected, subscribe } = useWebSocket({
    autoConnect: !isPreviewMode,
    onScheduleUpdate: (data) => {
      console.log('[Display] Schedule updated via WebSocket');
      const deviceId = pairedDeviceIdRef.current;
      if (deviceId) {
        refreshDeviceDisplayConfig(deviceId, { silent: true });
        return;
      }
      setLocalSchedule(data);
    },
    onSettingsUpdate: (data) => {
      console.log('[Display] Settings updated via WebSocket');
      const deviceId = pairedDeviceIdRef.current;
      if (deviceId) {
        refreshDeviceDisplayConfig(deviceId, { silent: true });
        return;
      }
      setLocalSettings(migrateSettings(data));
    },
    onDeviceUpdate: (data) => {
      const deviceId = pairedDeviceIdRef.current;
      if (!deviceId) return;

      const updatedDeviceId = typeof data.id === 'string' ? data.id : null;
      if (updatedDeviceId && updatedDeviceId !== deviceId) return;

      refreshDeviceDisplayConfig(deviceId, { silent: true });
    },
    onDeviceCommand: (command) => {
      console.log('[Display] Command received:', command);
      if (command === 'reload' || command === 'restart') {
        window.location.reload();
      }
      if (command === 'clear-cache') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
    },
  });

  // Subscribe to updates once connected and paired
  useEffect(() => {
    if (isPreviewMode) return;

    if (isConnected && pairingInfo?.paired && pairingInfo?.id) {
      subscribe('schedule');
      subscribe('settings');
      subscribe('device', pairingInfo.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, pairingInfo?.paired, pairingInfo?.id, isPreviewMode]);

  // Heartbeat system (only when paired)
  useEffect(() => {
    if (isPreviewMode) return;
    if (!pairingInfo?.paired || !pairingInfo?.id) return;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch(`${API_URL}/api/devices/${pairingInfo.id}/heartbeat`, {
          method: 'POST',
        });
        if (response.ok) {
          console.log('[Display] Heartbeat sent');
        }
      } catch (error) {
        console.error('[Display] Heartbeat failed:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat();

    // Send heartbeat every 2 minutes
    const interval = setInterval(sendHeartbeat, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [pairingInfo, isPreviewMode]);

  useEffect(() => {
    const interval = setInterval(() => setEventClock(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const effectiveSettings = useMemo(() => {
    const baseSettings = migrateSettings(localSettings || getDefaultSettings());
    const activeEvent = getActiveEvent(baseSettings, new Date(eventClock));
    const overrides = activeEvent?.settingsOverrides;

    if (!isPlainRecord(overrides)) {
      return baseSettings;
    }

    const merged = deepMergeRecords(
      baseSettings as unknown as Record<string, unknown>,
      overrides
    ) as unknown as Settings;

    const overridePalette =
      typeof overrides.colorPalette === 'string'
        ? (overrides.colorPalette as ColorPaletteName)
        : undefined;
    if (overridePalette) {
      const paletteTheme = generateDashboardColors(getColorPalette(overridePalette));
      const overrideTheme = isPlainRecord(overrides.theme)
        ? (overrides.theme as Partial<ThemeColors>)
        : undefined;
      merged.colorPalette = overridePalette;
      merged.theme = generateDashboardColors({
        ...paletteTheme,
        ...(overrideTheme || {}),
      });
    }

    return migrateSettings(merged);
  }, [localSettings, eventClock]);

  const effectiveAudio = useMemo(
    () => normalizeAudio(effectiveSettings.audio),
    [effectiveSettings.audio]
  );

  const effectiveAudioSrc = useMemo(
    () => (effectiveAudio.enabled && effectiveAudio.src ? toAbsoluteMediaUrl(effectiveAudio.src) : ''),
    [effectiveAudio.enabled, effectiveAudio.src]
  );

  const tryPlayAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !effectiveAudio.enabled || !effectiveAudioSrc) return;

    try {
      audio.muted = false;
      audio.volume = effectiveAudio.volume;
      await audio.play();
      setIsAudioBlocked(false);
      return;
    } catch {
      // Fallback: start muted (allowed by most autoplay policies), then unmute.
    }

    try {
      audio.muted = true;
      await audio.play();
      audio.muted = false;
      audio.volume = effectiveAudio.volume;
      setIsAudioBlocked(false);
    } catch (error) {
      audio.pause();
      setIsAudioBlocked(true);
      console.warn('[Display] Audio autoplay blocked:', error);
    }
  }, [effectiveAudio.enabled, effectiveAudio.volume, effectiveAudioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!effectiveAudio.enabled || !effectiveAudioSrc) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setIsAudioBlocked(false);
      return;
    }

    if (audio.getAttribute('src') !== effectiveAudioSrc) {
      audio.setAttribute('src', effectiveAudioSrc);
      audio.load();
    }

    audio.loop = effectiveAudio.loop;
    audio.volume = effectiveAudio.volume;
    void tryPlayAudio();
  }, [effectiveAudio.enabled, effectiveAudio.loop, effectiveAudio.volume, effectiveAudioSrc, tryPlayAudio]);

  useEffect(() => {
    if (!isAudioBlocked || !effectiveAudio.enabled || !effectiveAudioSrc) return;

    const unlockAudio = () => {
      void tryPlayAudio();
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [isAudioBlocked, effectiveAudio.enabled, effectiveAudioSrc, tryPlayAudio]);

  // Slideshow
  const {
    currentSlide,
    currentSlideIndex,
    totalSlides,
    layout,
    enableTransitions,
    showSlideIndicators,
    showZoneBorders,
    onVideoEnded,
    zones,
    getZoneSlide,
    getZoneInfo,
  } = useSlideshow({
    settings: effectiveSettings,
    enabled: true,
  });

  // Pairing screen - show if not paired
  if (!isPreviewMode && isPairingLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center">
          <div className="text-3xl font-bold mb-4">HTMLSignage</div>
          <div className="text-lg">Wird geladen...</div>
        </div>
      </div>
    );
  }

  if (!isPreviewMode && !pairingInfo?.paired && pairingInfo?.pairingCode) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center max-w-2xl px-8">
          <div className="text-4xl font-bold mb-8">HTMLSignage</div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Gerät nicht gepairt</h2>
            <p className="text-lg mb-8 opacity-90">
              Bitte geben Sie diesen Pairing-Code im Admin-Interface ein:
            </p>

            <div className="bg-white text-spa-primary rounded-2xl p-8 mb-6">
              <div className="text-7xl font-bold tracking-wider font-mono">
                {pairingInfo.pairingCode}
              </div>
            </div>

            <p className="text-sm opacity-75">
              Öffnen Sie das Admin-Interface unter /devices und geben Sie diesen Code ein.
            </p>
          </div>

          <div className="text-sm opacity-60">
            Device ID: {pairingInfo.id.slice(0, 12)}...
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  const isLoading =
    isPreviewMode
      ? scheduleLoading || settingsLoading
      : ((!pairingInfo?.paired && (scheduleLoading || settingsLoading)) ||
          (pairingInfo?.paired && isDisplayConfigLoading && !hasLoadedDeviceConfig));

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">HTMLSignage</div>
          <div className="text-lg">Wird geladen...</div>
          <div className="text-sm mt-2 opacity-70">
            {isPreviewMode ? 'Vorschau' : (isConnected ? 'Verbunden' : 'Verbinde...')}
          </div>
        </div>
      </div>
    );
  }

  const designStyle = effectiveSettings.designStyle || 'modern-wellness';
  const isModernWellness = designStyle === 'modern-wellness';
  const isModernTimeline = designStyle === 'modern-timeline';
  const isModernDesign = isModernWellness || isModernTimeline;

  const renderContentPanel = () => {
    if (isModernTimeline) {
      return <TimelineScheduleSlide schedule={localSchedule} settings={effectiveSettings} />;
    }
    return <ScheduleGridSlide schedule={localSchedule} settings={effectiveSettings} />;
  };

  // Safety: old configs might contain legacy layout strings; render them as split-view instead of breaking.
  const safeLayout = normalizeLayout(layout);

  const hasAnyZoneSlides = zones.some((z) => (getZoneInfo(z.id)?.totalSlides ?? 0) > 0);

  // If no slides configured, show default overview
  if (!hasAnyZoneSlides) {
    return (
      <div className="w-full h-screen overflow-hidden">
        {isModernDesign ? (
          renderContentPanel()
        ) : (
          <OverviewSlide schedule={localSchedule} settings={effectiveSettings} />
        )}
      </div>
    );
  }

  // Get defaults for header and theme
  const defaults = getDefaultSettings();
  const themeColors = effectiveSettings.theme || defaults.theme!;

  // Render based on layout
  const renderLayout = () => {
    const renderSplitLikeLayout = () => {
      // Get zones for this layout
      const splitZones = zones.filter((z) => z.id === 'persistent' || z.id === 'main');
      const persistentZone = splitZones.find((z) => z.id === 'persistent');
      const mainZone = splitZones.find((z) => z.id === 'main');

      const gridSizePercent = persistentZone?.size || 50;
      const isVertical = persistentZone?.position === 'left' || persistentZone?.position === 'right';
      const scheduleFirst = persistentZone?.position === 'left' || persistentZone?.position === 'top';

      // Get slides for each zone
      const persistentSlide = persistentZone ? getZoneSlide(persistentZone.id) : null;
      const persistentInfo = persistentZone ? getZoneInfo(persistentZone.id) : null;
      const mainSlide = mainZone ? getZoneSlide(mainZone.id) : null;
      const mainInfo = mainZone ? getZoneInfo(mainZone.id) : null;

      const theme = themeColors;
      const leftBg = theme.zebra1 || '#F7F3E9';
      const rightBg = theme.zebra2 || '#F2EDE1';
      const border = theme.gridTable || '#EBE5D3';

      const hasPersistent = Boolean(persistentSlide);
      const hasMain = Boolean(mainSlide);

      const persistentSize = hasPersistent && hasMain ? gridSizePercent : hasPersistent ? 100 : 0;
      const mainSize = hasPersistent && hasMain ? 100 - gridSizePercent : hasMain ? 100 : 0;

      const renderZoneSlide = (
        slide: SlideConfig | null,
        zone?: Zone,
      ) => {
        if (!slide) {
          return (
            <div className="w-full h-full flex items-center justify-center text-spa-text-secondary">
              Keine Slides
            </div>
          );
        }

        const mediaSlide = isMediaSlide(slide);
        const needsPadding = needsModernSlidePadding(isModernDesign, slide);

        const rendered = (
          <SlideRenderer schedule={localSchedule} settings={effectiveSettings} slide={slide} onVideoEnded={() => zone && onVideoEnded(zone.id)} />
        );

        if (!needsPadding) return rendered;

        if (mediaSlide) {
          return (
            <div className="p-8 w-full h-full">
              <div className="w-full h-full rounded-[2rem] overflow-hidden border-4 border-white shadow-lg">
                {rendered}
              </div>
            </div>
          );
        }

        return <div className="p-8 w-full h-full">{rendered}</div>;
      };

      if (isVertical) {
        return (
          <div className="w-full h-full flex">
            {scheduleFirst ? (
              <>
                {hasPersistent && (
                  <div
                    className={clsx(isModernDesign && hasMain && showZoneBorders && 'border-r')}
                    style={{
                      width: `${persistentSize}%`,
                      borderColor: isModernDesign && showZoneBorders ? border : undefined,
                      backgroundColor: isModernDesign ? leftBg : undefined,
                    }}
                  >
                    <SlideTransition
                      slideKey={persistentSlide?.id || 'persistent'}
                      enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                      duration={0.6}
                    >
                      {renderZoneSlide(persistentSlide, persistentZone)}
                    </SlideTransition>
                  </div>
                )}

                {hasMain && (
                  <div
                    style={{
                      width: `${mainSize}%`,
                      backgroundColor: isModernDesign ? rightBg : undefined,
                    }}
                  >
                    <SlideTransition
                      slideKey={mainSlide?.id || 'main'}
                      enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                      duration={0.6}
                    >
                      {renderZoneSlide(mainSlide, mainZone)}
                    </SlideTransition>
                  </div>
                )}
              </>
            ) : (
              <>
                {hasMain && (
                  <div
                    className={clsx(isModernDesign && hasPersistent && showZoneBorders && 'border-r')}
                    style={{
                      width: `${mainSize}%`,
                      borderColor: isModernDesign && showZoneBorders ? border : undefined,
                      backgroundColor: isModernDesign ? leftBg : undefined,
                    }}
                  >
                    <SlideTransition
                      slideKey={mainSlide?.id || 'main'}
                      enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                      duration={0.6}
                    >
                      {renderZoneSlide(mainSlide, mainZone)}
                    </SlideTransition>
                  </div>
                )}

                {hasPersistent && (
                  <div
                    style={{
                      width: `${persistentSize}%`,
                      backgroundColor: isModernDesign ? rightBg : undefined,
                    }}
                  >
                    <SlideTransition
                      slideKey={persistentSlide?.id || 'persistent'}
                      enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                      duration={0.6}
                    >
                      {renderZoneSlide(persistentSlide, persistentZone)}
                    </SlideTransition>
                  </div>
                )}
              </>
            )}
          </div>
        );
      }

      return (
        <div className="w-full h-full flex flex-col">
          {scheduleFirst ? (
            <>
              {hasPersistent && (
                <div
                  className={clsx(isModernDesign && hasMain && showZoneBorders && 'border-b')}
                  style={{
                    height: `${persistentSize}%`,
                    borderColor: isModernDesign && showZoneBorders ? border : undefined,
                    backgroundColor: isModernDesign ? leftBg : undefined,
                  }}
                >
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {renderZoneSlide(persistentSlide, persistentZone)}
                  </SlideTransition>
                </div>
              )}

              {hasMain && (
                <div
                  style={{
                    height: `${mainSize}%`,
                    backgroundColor: isModernDesign ? rightBg : undefined,
                  }}
                >
                  <SlideTransition
                    slideKey={mainSlide?.id || 'main'}
                    enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {renderZoneSlide(mainSlide, mainZone)}
                  </SlideTransition>
                </div>
              )}
            </>
          ) : (
            <>
              {hasMain && (
                <div
                  className={clsx(isModernDesign && hasPersistent && showZoneBorders && 'border-b')}
                  style={{
                    height: `${mainSize}%`,
                    borderColor: isModernDesign && showZoneBorders ? border : undefined,
                    backgroundColor: isModernDesign ? leftBg : undefined,
                  }}
                >
                  <SlideTransition
                    slideKey={mainSlide?.id || 'main'}
                    enabled={enableTransitions && (mainInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {renderZoneSlide(mainSlide, mainZone)}
                  </SlideTransition>
                </div>
              )}

              {hasPersistent && (
                <div
                  style={{
                    height: `${persistentSize}%`,
                    backgroundColor: isModernDesign ? rightBg : undefined,
                  }}
                >
                  <SlideTransition
                    slideKey={persistentSlide?.id || 'persistent'}
                    enabled={enableTransitions && (persistentInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {renderZoneSlide(persistentSlide, persistentZone)}
                  </SlideTransition>
                </div>
              )}
            </>
          )}
        </div>
      );
    };

    switch (safeLayout) {
      case 'full-rotation':
        {
          const zoneWithSlides = zones.find((z) => (getZoneInfo(z.id)?.totalSlides ?? 0) > 0);
          const zoneId = zoneWithSlides?.id || zones[0]?.id || 'main';
          const slide = getZoneSlide(zoneId) || currentSlide;
          if (!slide) return null;

          const mediaSlide = isMediaSlide(slide);
          const needsPadding = needsModernSlidePadding(isModernDesign, slide);

          const rendered = (
            <SlideRenderer schedule={localSchedule} settings={effectiveSettings} slide={slide} onVideoEnded={() => onVideoEnded(zoneId)} />
          );

          return (
            <SlideTransition
              slideKey={slide?.id || currentSlideIndex}
              enabled={enableTransitions}
              duration={0.6}
            >
              {needsPadding ? (
                mediaSlide ? (
                  <div className="p-8 w-full h-full">
                    <div className="w-full h-full rounded-[2rem] overflow-hidden border-4 border-white shadow-lg">
                      {rendered}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 w-full h-full">{rendered}</div>
                )
              ) : (
                rendered
              )}
            </SlideTransition>
          );
        }

      case 'split-view':
        return renderSplitLikeLayout();

      case 'triple-view':
        if (isModernDesign) {
          const tripleZones = zones.filter((z) => z.id === 'left' || z.id === 'top-right' || z.id === 'bottom-right');
          const leftZone = tripleZones.find((z) => z.id === 'left');
          const topRightZone = tripleZones.find((z) => z.id === 'top-right');
          const bottomRightZone = tripleZones.find((z) => z.id === 'bottom-right');

          const leftSlide = leftZone ? getZoneSlide(leftZone.id) : null;
          const topRightSlide = topRightZone ? getZoneSlide(topRightZone.id) : null;
          const bottomRightSlide = bottomRightZone ? getZoneSlide(bottomRightZone.id) : null;

          const topRightInfo = topRightZone ? getZoneInfo(topRightZone.id) : null;

          const leftSize = leftZone?.size || (isModernTimeline ? 65 : 60);
          const rightSize = 100 - leftSize;
          const topDurationSec = (topRightSlide?.duration ?? 12);

          const theme = themeColors;
          const leftBg = theme.zebra1 || '#F7F3E9';
          const rightBg = theme.zebra2 || '#F2EDE1';
          const border = theme.gridTable || '#EBE5D3';
          const bottomBg = withAlpha(rightBg, 0.6);

          const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
          const accentGold = theme.accentGold || theme.accent || '#A68A64';

          return (
            <div className="w-full h-full flex relative overflow-hidden">
              {/* Left Panel: Content grid/timeline or media */}
              <div
                className={clsx('h-full relative overflow-hidden', showZoneBorders && 'border-r')}
                style={{
                  width: `${leftSize}%`,
                  backgroundColor: leftBg,
                  borderColor: showZoneBorders ? border : undefined,
                }}
              >
                <AnimatePresence mode="wait">
                  {!leftSlide || leftSlide.type === 'content-panel' ? (
                    <motion.div
                      key={`content-panel-${designStyle}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1 }}
                      className="w-full h-full"
                    >
                      {renderContentPanel()}
                    </motion.div>
                  ) : (
                    <motion.div
                      key={leftSlide?.id || 'media-left'}
                      initial={{ x: -100, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 100, opacity: 0 }}
                      transition={{ duration: 1.2 }}
                      className="w-full h-full"
                    >
                      {leftSlide?.type?.startsWith('media-') ? (
                        <div className="p-5 w-full h-full">
                          <div className="w-full h-full rounded-[2.5rem] overflow-hidden border-[6px] border-white shadow-xl">
                            <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                              slide={leftSlide}
                              onVideoEnded={() => leftZone && onVideoEnded(leftZone.id)}
                            />
                          </div>
                        </div>
                      ) : (
                        <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                          slide={leftSlide}
                          onVideoEnded={() => leftZone && onVideoEnded(leftZone.id)}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right Panel (40%): Detail + Bottom */}
              <div
                className="h-full flex flex-col relative overflow-hidden"
                style={{
                  width: `${rightSize}%`,
                  backgroundColor: rightBg,
                }}
              >
                {/* Right Top */}
                <div className="flex-1 relative overflow-hidden flex flex-col">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={topRightSlide?.id || topRightInfo?.currentSlideIndex || 0}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                      className="absolute inset-0 flex flex-col"
                    >
                      {topRightSlide?.type === 'sauna-detail' ? (
                        <SaunaDetailDashboard
                          schedule={localSchedule}
                          settings={effectiveSettings}
                          saunaId={topRightSlide.saunaId}
                        />
                      ) : topRightSlide ? (
                        topRightSlide.type?.startsWith('media-') ? (
                          <div className="p-5 w-full h-full">
                            <div className="w-full h-full rounded-[2.3rem] overflow-hidden border-[6px] border-white shadow-xl">
                              <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                                slide={topRightSlide}
                                onVideoEnded={() => topRightZone && onVideoEnded(topRightZone.id)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full">
                            <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                              slide={topRightSlide}
                              onVideoEnded={() => topRightZone && onVideoEnded(topRightZone.id)}
                            />
                          </div>
                        )
                      ) : (
                        <SaunaDetailDashboard schedule={localSchedule} settings={effectiveSettings} saunaId={undefined} />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Right Bottom */}
                <div
                  className={clsx('h-56 p-8 relative shrink-0 overflow-hidden', showZoneBorders && 'border-t')}
                  style={{
                    backgroundColor: bottomBg,
                    borderColor: showZoneBorders ? border : undefined,
                  }}
                >
                  <AnimatePresence mode="wait">
                    {bottomRightSlide ? (
                      <motion.div
                        key={bottomRightSlide.id || 'bottom-slide'}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="w-full h-full"
                      >
                        {bottomRightSlide.type?.startsWith('media-') ? (
                          <div className="p-2 w-full h-full">
                            <div className="w-full h-full rounded-[1.8rem] overflow-hidden border-4 border-white shadow-lg">
                              <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                                slide={bottomRightSlide}
                                onVideoEnded={() => bottomRightZone && onVideoEnded(bottomRightZone.id)}
                              />
                            </div>
                          </div>
                        ) : (
                          <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                            slide={bottomRightSlide}
                            onVideoEnded={() => bottomRightZone && onVideoEnded(bottomRightZone.id)}
                          />
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="bottom-fallback"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className="w-full h-full"
                      >
                        <WellnessBottomPanel settings={effectiveSettings} theme={themeColors} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress Bar */}
              {(topRightInfo?.shouldRotate || false) && (
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/[0.03]">
                  <motion.div
                    key={topRightSlide?.id || topRightInfo?.currentSlideIndex || 0}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: topDurationSec, ease: 'linear' }}
                    className="h-full"
                    style={{
                      background: `linear-gradient(to right, ${accentGreen}, ${accentGold})`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        }

        // Get zones for this layout
        const tripleZones = zones.filter((z) => z.id === 'left' || z.id === 'top-right' || z.id === 'bottom-right');
        const leftZone = tripleZones.find((z) => z.id === 'left');
        const topRightZone = tripleZones.find((z) => z.id === 'top-right');
        const bottomRightZone = tripleZones.find((z) => z.id === 'bottom-right');

        const leftSlide = leftZone ? getZoneSlide(leftZone.id) : null;
        const topRightSlide = topRightZone ? getZoneSlide(topRightZone.id) : null;
        const bottomRightSlide = bottomRightZone ? getZoneSlide(bottomRightZone.id) : null;

        // Get sizes from zones
        const leftSize = leftZone?.size || 66;
        const topRightSize = topRightZone?.size || 50;

        // Get zone info to check if should rotate
        const leftInfo = leftZone ? getZoneInfo(leftZone.id) : null;
        const topRightInfo = topRightZone ? getZoneInfo(topRightZone.id) : null;
        const bottomRightInfo = bottomRightZone ? getZoneInfo(bottomRightZone.id) : null;

        return (
          <div className="w-full h-full flex">
            {/* Left Panel */}
            {leftSlide && (
              <div style={{ width: `${leftSize}%` }}>
                <SlideTransition
                  slideKey={leftSlide?.id || 'left'}
                  enabled={enableTransitions && (leftInfo?.shouldRotate || false)}
                  duration={0.6}
                >
                  {leftSlide.type === 'content-panel' ? (
                    <ScheduleGridSlide schedule={localSchedule} settings={effectiveSettings} />
                  ) : (
                    <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                      slide={leftSlide}
                      onVideoEnded={() => leftZone && onVideoEnded(leftZone.id)}
                    />
                  )}
                </SlideTransition>
              </div>
            )}

            {/* Right Panel - Split Top/Bottom */}
            <div style={{ width: `${100 - leftSize}%` }} className="flex flex-col">
              {/* Top Right */}
              {topRightSlide && (
                <div style={{ height: `${topRightSize}%` }}>
                  <SlideTransition
                    slideKey={topRightSlide?.id || `top-right-${topRightSlide?.saunaId || 0}`}
                    enabled={enableTransitions && (topRightInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {topRightSlide.type === 'sauna-detail' ? (
                      <SaunaDetailDashboard
                        schedule={localSchedule}
                        settings={effectiveSettings}
                        saunaId={topRightSlide.saunaId}
                      />
                    ) : (
                      <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                        slide={topRightSlide}
                        onVideoEnded={() => topRightZone && onVideoEnded(topRightZone.id)}
                      />
                    )}
                  </SlideTransition>
                </div>
              )}

              {/* Bottom Right */}
              {bottomRightSlide && (
                <div style={{ height: `${100 - topRightSize}%` }}>
                  <SlideTransition
                    slideKey={bottomRightSlide?.id || `bottom-right-${bottomRightSlide?.saunaId || 1}`}
                    enabled={enableTransitions && (bottomRightInfo?.shouldRotate || false)}
                    duration={0.6}
                  >
                    {bottomRightSlide.type === 'sauna-detail' ? (
                      <SaunaDetailDashboard
                        schedule={localSchedule}
                        settings={effectiveSettings}
                        saunaId={bottomRightSlide.saunaId}
                      />
                    ) : (
                      <SlideRenderer schedule={localSchedule} settings={effectiveSettings}
                        slide={bottomRightSlide}
                        onVideoEnded={() => bottomRightZone && onVideoEnded(bottomRightZone.id)}
                      />
                    )}
                  </SlideTransition>
                </div>
              )}
            </div>
          </div>
        );

      case 'grid-2x2':
        {
          const theme = themeColors;
          const border = theme.gridTable || '#EBE5D3';
          const bgBase = theme.dashboardBg || theme.bg || '#FDFBF7';
          const bg1 = theme.zebra1 || bgBase;
          const bg2 = theme.zebra2 || bgBase;

          const cellBgForIndex = (idx: number) => {
            // Checker pattern (TL/TR/BL/BR): 1/2/2/1
            return idx === 0 || idx === 3 ? bg1 : bg2;
          };

          const renderCell = (zoneId: string) => {
            const slide = getZoneSlide(zoneId);

            const mediaSlide = isMediaSlide(slide);
            const needsPadding = needsModernSlidePadding(isModernDesign, slide);

            const rendered = slide ? (
              <SlideRenderer schedule={localSchedule} settings={effectiveSettings} slide={slide} onVideoEnded={() => onVideoEnded(zoneId)} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-spa-text-secondary">
                Keine Slides
              </div>
            );

            if (!slide || !needsPadding) return rendered;

            if (mediaSlide) {
              return (
                <div className="p-6 w-full h-full">
                  <div className="w-full h-full rounded-[2rem] overflow-hidden border-4 border-white shadow-lg">
                    {rendered}
                  </div>
                </div>
              );
            }

            return <div className="p-6 w-full h-full">{rendered}</div>;
          };

          return (
            <div className="w-full h-full p-8" style={{ backgroundColor: isModernDesign ? bgBase : undefined }}>
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-6">
                {zones.slice(0, 4).map((zone, idx) => {
                  const info = getZoneInfo(zone.id);
                  const slide = getZoneSlide(zone.id);

                  return (
                    <div
                      key={zone.id}
                      className={clsx(
                        'relative overflow-hidden',
                        isModernDesign ? 'rounded-[2rem]' : '',
                        isModernDesign && showZoneBorders ? 'border' : ''
                      )}
                      style={{
                        borderColor: isModernDesign && showZoneBorders ? border : undefined,
                        backgroundColor: isModernDesign ? cellBgForIndex(idx) : undefined,
                      }}
                    >
                      <SlideTransition
                        slideKey={slide?.id || `${zone.id}-empty`}
                        enabled={enableTransitions && (info?.shouldRotate || false)}
                        duration={0.6}
                      >
                        {renderCell(zone.id)}
                      </SlideTransition>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

      default:
        {
          // Should never happen because safeLayout normalizes unknown values.
          return renderSplitLikeLayout();
        }
    }
  };

  return (
    <div
      className="w-full h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: themeColors.dashboardBg || themeColors.bg }}
    >
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {renderLayout()}
      </div>

      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        className="hidden"
      />

      {isAudioBlocked && effectiveAudio.enabled && Boolean(effectiveAudioSrc) && (
        <button
          onClick={() => {
            void tryPlayAudio();
          }}
          className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-black/75 text-white text-sm hover:bg-black"
        >
          {isPreviewMode ? 'Audio in Vorschau aktivieren' : 'Audio aktivieren'}
        </button>
      )}

      {/* Slide Indicators */}
      {showSlideIndicators && totalSlides > 1 && !isModernDesign && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2 z-50">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'w-3 h-3 rounded-full transition-all',
                i === currentSlideIndex
                  ? 'bg-white w-8'
                  : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}

      {/* Connection indicator (dev mode) */}
      {ENV_IS_DEV && (
        <div
          className="fixed top-4 right-4 px-3 py-2 rounded-lg text-xs font-mono z-50"
          style={{
            backgroundColor: isConnected ? '#10B981' : '#EF4444',
            color: 'white',
          }}
        >
          {isConnected ? '● Connected' : '● Disconnected'}
          {pairingInfo?.id && (
            <div className="text-xs opacity-75">ID: {pairingInfo.id.slice(0, 8)}</div>
          )}
          <div className="text-xs opacity-75 mt-1">
            Slide {currentSlideIndex + 1}/{totalSlides}
          </div>
          <div className="text-xs opacity-75">Layout: {safeLayout}</div>
        </div>
      )}
    </div>
  );
}
