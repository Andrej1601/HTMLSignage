import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSlideshow } from '@/hooks/useSlideshow';
import { useDisplayClientRuntime } from '@/hooks/useDisplayClientRuntime';
import { useDisplaySnapshotCapture } from '@/hooks/useDisplaySnapshotCapture';
import { DisplayLayoutRenderer } from '@/components/Display/DisplayLayoutRenderer';
import { normalizeDisplayLayout } from '@/components/Display/displayLayoutUtils';
import { generateDashboardColors, getColorPalette, getDefaultSettings } from '@/types/settings.types';
import type { SlideConfig } from '@/types/slideshow.types';
import { ENV_IS_DEV } from '@/config/env';
import { isModernScheduleDesignStyleValue } from '@/config/displayDesignStyles';
import { migrateSettings } from '@/utils/slideshowMigration';
import { classNames } from '@/utils/classNames';
import { normalizeAudioSettings } from '@/utils/audioUtils';
import { prefetchDisplayAssets } from '@/utils/displayAssetCache';
import { useResilientMediaSource } from '@/hooks/useResilientMediaSource';
import { normalizeMaintenanceScreenSettings } from '@/config/maintenanceScreen';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import {
  applyActiveEventSettings,
  collectDisplayAssetUrls,
  resolveAudioSourceUrl,
} from '@/utils/displaySettings';

type TransitionType = NonNullable<SlideConfig['transition']>;

function readDisplayPreviewFlag(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

export function DisplayClientPage() {
  const isPreviewMode = readDisplayPreviewFlag();
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const displayRootRef = useRef<HTMLDivElement | null>(null);
  const lastPrefetchedAssetSignatureRef = useRef<string | null>(null);
  const {
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
  } = useDisplayClientRuntime(isPreviewMode);

  const effectiveSettings = useMemo(() => {
    const { settings: base } = applyActiveEventSettings(
      migrateSettings(localSettings || getDefaultSettings()),
      new Date(eventClock),
      displayDeviceId,
    );
    // Apply design overrides from slideshow config onto top-level settings
    const sc = base.slideshow;
    if (!sc) return base;
    const merged = { ...base };
    if (sc.displayAppearance) merged.displayAppearance = sc.displayAppearance;
    if (sc.designStyle) merged.designStyle = sc.designStyle;
    if (sc.saunaDetailStyle) merged.saunaDetailStyle = sc.saunaDetailStyle;
    if (sc.colorPalette) {
      merged.colorPalette = sc.colorPalette;
      merged.theme = generateDashboardColors(getColorPalette(sc.colorPalette));
    }
    if (sc.header && Object.keys(sc.header).length > 0) {
      merged.header = { ...(merged.header ?? {}), ...sc.header } as typeof merged.header;
    }
    // Per-slideshow maintenance-screen override. Missing fields fall
    // through to the global `settings.maintenanceScreen`, matching the
    // header-override semantics operators already rely on.
    if (sc.maintenanceScreen && Object.keys(sc.maintenanceScreen).length > 0) {
      merged.maintenanceScreen = {
        ...(merged.maintenanceScreen ?? {}),
        ...sc.maintenanceScreen,
      } as typeof merged.maintenanceScreen;
    }
    return merged;
  }, [displayDeviceId, localSettings, eventClock]);

  // Audio: disabled in preview mode, slideshow audioOverride takes priority over global
  const resolvedAudioSettings = useMemo(() => {
    if (isPreviewMode) return { enabled: false, volume: 0, loop: false };
    const slideshowAudio = effectiveSettings.slideshow?.audioOverride;
    if (slideshowAudio?.enabled && slideshowAudio.src) return slideshowAudio;
    return effectiveSettings.audio;
  }, [effectiveSettings.slideshow?.audioOverride, effectiveSettings.audio, isPreviewMode]);

  const effectiveAudio = useMemo(
    () => normalizeAudioSettings(resolvedAudioSettings),
    [resolvedAudioSettings],
  );

  const effectiveAudioSourceUrl = useMemo(
    () => resolveAudioSourceUrl(resolvedAudioSettings, mediaItems),
    [resolvedAudioSettings, mediaItems],
  );

  // `normalizeMaintenanceScreenSettings` is a pure, cheap normaliser.
  // React Compiler handles the memoization — manual `useMemo` wrappers
  // around reads from `effectiveSettings.maintenanceScreen` trip its
  // "preserve manual memoization" lint when the source sometimes comes
  // from a merge and sometimes from settings directly.
  const maintenanceScreen = normalizeMaintenanceScreenSettings(
    effectiveSettings.maintenanceScreen,
  );

  const maintenanceBackgroundUrl = getMediaUploadUrl(
    mediaItems,
    maintenanceScreen.backgroundImageId,
  );

  const {
    resolvedSrc: effectiveAudioSrc,
    handleError: handleAudioError,
  } = useResilientMediaSource(effectiveAudioSourceUrl);

  const displayAssetUrls = useMemo(
    () => collectDisplayAssetUrls(effectiveSettings, mediaItems),
    [effectiveSettings, mediaItems],
  );
  const displayAssetSignature = useMemo(
    () => displayAssetUrls.join('|'),
    [displayAssetUrls],
  );
  useEffect(() => {
    if (lastPrefetchedAssetSignatureRef.current === displayAssetSignature) {
      return;
    }

    lastPrefetchedAssetSignatureRef.current = displayAssetSignature;
    void prefetchDisplayAssets(displayAssetUrls);
  }, [displayAssetSignature, displayAssetUrls]);

  // Design packs handle their own code-split loading via dynamic imports
  // registered in `@/designs/registry.ts`. The old per-slide-type preload
  // was specific to the retired `displayDynamicModules` lazy loaders.

  const tryPlayAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || maintenanceMode || !effectiveAudio.enabled || !effectiveAudioSrc) return;

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
  }, [effectiveAudio.enabled, effectiveAudio.volume, effectiveAudioSrc, maintenanceMode]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (maintenanceMode || !effectiveAudio.enabled || !effectiveAudioSrc) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    if (audio.getAttribute('src') !== effectiveAudioSrc) {
      audio.setAttribute('src', effectiveAudioSrc);
      audio.load();
    }

    audio.loop = effectiveAudio.loop;
    audio.volume = effectiveAudio.volume;
    // Schedule play attempt outside effect to avoid cascading setState
    const timer = setTimeout(() => { void tryPlayAudio(); }, 0);
    return () => clearTimeout(timer);
  }, [effectiveAudio.enabled, effectiveAudio.loop, effectiveAudio.volume, effectiveAudioSrc, maintenanceMode, tryPlayAudio]);

  useEffect(() => {
    if (!isAudioBlocked || !effectiveAudio.enabled || !effectiveAudioSrc) return;

    const unlockAudio = () => {
      void tryPlayAudio();
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    // Kiosk-Recovery: in der Live-Auspielung (cursor: none, keine
    // Tastatur am Display) wird `pointerdown`/`keydown` nie feuern.
    // Damit das Spa nicht stundenlang stumm läuft, versuchen wir alle
    // 15 s erneut zu starten — Browser-Autoplay-Policies entsperren
    // sich z. B. nach Page-Visibility-Wechseln, Settings-Updates oder
    // wenn der Browser inzwischen einen User-Activation-Token bekommen
    // hat. Im Preview-Modus lassen wir den Button weiter die Hauptrolle
    // spielen — der Admin sieht so klar, dass etwas nicht passt.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (!isPreviewMode) {
      intervalId = setInterval(() => {
        void tryPlayAudio();
      }, 15_000);
    }

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAudioBlocked, effectiveAudio.enabled, effectiveAudioSrc, tryPlayAudio, isPreviewMode]);

  // Slideshow
  const {
    currentSlide,
    currentSlideIndex,
    totalSlides,
    layout,
    enableTransitions,
    defaultTransition,
    showSlideIndicators,
    showZoneBorders,
    onVideoEnded,
    zones,
    getZoneSlide,
    getZoneInfo,
  } = useSlideshow({
    settings: effectiveSettings,
    enabled: true,
    media: mediaItems,
  });

  const resolveTransition = useCallback(
    (slide: SlideConfig | null | undefined): TransitionType => slide?.transition || defaultTransition,
    [defaultTransition]
  );

  const defaults = useMemo(() => getDefaultSettings(), []);
  const themeColors = effectiveSettings.theme || defaults.theme!;
  const safeLayout = normalizeDisplayLayout(layout);
  const isLoading =
    isPreviewMode
      ? scheduleLoading || settingsLoading
      : ((!pairingInfo?.paired && (scheduleLoading || settingsLoading)) ||
          (pairingInfo?.paired && isDisplayConfigLoading && !hasLoadedDeviceConfig));
  const canCaptureSnapshots = Boolean(
    !isPreviewMode &&
    pairingInfo?.paired &&
    pairingInfo?.id &&
    deviceToken &&
    !isLoading
  );
  useDisplaySnapshotCapture({
    canCaptureSnapshots,
    currentSlideIndex,
    deviceId: pairingInfo?.id || null,
    deviceToken,
    displayRootRef,
    layoutKey: safeLayout,
    snapshotBackgroundColor: themeColors.dashboardBg || themeColors.bg || '#000000',
  });

  // Pairing screen - show if not paired
  if (!isPreviewMode && isPairingLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-linear-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center">
          <div className="text-3xl font-bold mb-4">Signage Control Center</div>
          <div className="text-lg">Wird geladen...</div>
        </div>
      </div>
    );
  }

  if (!isPreviewMode && !pairingInfo?.paired && pairingInfo?.pairingCode) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-linear-to-br from-spa-primary to-spa-primary-dark text-white">
        <div className="text-center max-w-2xl px-8">
          <div className="text-4xl font-bold mb-8">Signage Control Center</div>

          <div className="bg-spa-surface/10 backdrop-blur-lg rounded-3xl p-12 mb-8">
            <h2 className="text-2xl font-semibold mb-6">Gerät nicht gepairt</h2>
            {/* Erklärtext aus 1-2 m Distanz lesbar — `text-base`
                statt `text-lg` mit voller Opacity statt opacity-90.
                Das Pairing erfolgt während Erstinstallation, der
                Saunameister steht direkt vor dem Display. */}
            <p className="text-base mb-8 leading-relaxed">
              Bitte geben Sie diesen Code in der Admin-Oberfläche ein:
            </p>

            <div className="bg-spa-surface text-spa-primary rounded-2xl p-8 mb-6">
              <div className="text-7xl font-bold tracking-wider font-mono">
                {pairingInfo.pairingCode}
              </div>
            </div>

            <p className="text-base leading-relaxed">
              Admin öffnen → <span className="font-semibold">Geräte</span> → Code eingeben
            </p>
          </div>

          {/* Device-ID auf opacity-80 statt 60 — der Wert ist eh winzig
              gerendert; weniger transparent macht ihn ohne mehr Platz
              überhaupt erst lesbar. */}
          <div className="text-sm opacity-80 font-mono">
            Geräte-ID: {pairingInfo.id.slice(0, 12)}…
          </div>
        </div>
      </div>
    );
  }

  if (!isLoading && maintenanceMode) {
    const bgStyle = maintenanceBackgroundUrl
      ? {
          backgroundImage: `linear-gradient(135deg, rgba(12, 8, 4, 0.58), rgba(34, 24, 16, 0.82)), url(${maintenanceBackgroundUrl})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }
      : { backgroundImage: 'radial-gradient(circle at top, #f2ebdf 0%, #d6b998 45%, #7f674d 100%)' };

    const isOverlay = maintenanceScreen.displayStyle === 'overlay';

    return (
      <div ref={displayRootRef} className="relative flex h-screen w-full items-center justify-center text-white overflow-hidden" style={bgStyle}>
        {isOverlay ? (
          /* Overlay-Stil: vollflächiger Blur-Schleier, zentrierter Text */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12" style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <div className="mb-6 inline-block rounded-full border border-spa-warning/60 bg-spa-warning/10 px-5 py-1.5 text-xs font-black uppercase tracking-widest text-spa-warning-light">
              {maintenanceScreen.label}
            </div>
            <h1 className="text-6xl font-bold tracking-tight leading-tight max-w-3xl">
              {maintenanceScreen.headline}
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-white/80 max-w-2xl">
              {maintenanceScreen.message}
            </p>
            {maintenanceScreen.showDeviceName && displayDeviceName && (
              <div className="absolute bottom-6 right-8 text-white/40 text-sm font-mono">
                {displayDeviceName}
              </div>
            )}
          </div>
        ) : (
          /* Glassmorphismus-Stil: zentrierte Karte */
          <div className="max-w-3xl rounded-[2rem] border border-white/20 bg-black/15 px-12 py-14 text-center shadow-2xl backdrop-blur-xl">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/75">
              {maintenanceScreen.label}
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight">
              {maintenanceScreen.headline}
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-white/85">
              {maintenanceScreen.message}
            </p>
            {maintenanceScreen.showDeviceName && displayDeviceName && (
              <div className="mt-8 inline-flex rounded-full border border-white/20 bg-spa-surface/10 px-5 py-2 text-sm font-medium text-white/85">
                {displayDeviceName}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-spa-text-primary text-white">
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
  const isModernDesign = isModernScheduleDesignStyleValue(designStyle);
  const displayNow = new Date(eventClock);

  return (
    <div
      ref={displayRootRef}
      className="w-full h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: themeColors.dashboardBg || themeColors.bg }}
    >
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        <DisplayLayoutRenderer
          currentSlide={currentSlide}
          currentSlideIndex={currentSlideIndex}
          currentTime={displayNow}
          designStyle={designStyle}
          displayDeviceId={displayDeviceId || undefined}
          effectiveSettings={effectiveSettings}
          enableTransitions={enableTransitions}
          getZoneInfo={getZoneInfo}
          getZoneSlide={getZoneSlide}
          isModernDesign={isModernDesign}
          localSchedule={localSchedule}
          mediaItems={mediaItems}
          onVideoEnded={onVideoEnded}
          resolveTransition={resolveTransition}
          safeLayout={safeLayout}
          showZoneBorders={showZoneBorders}
          themeColors={themeColors}
          zones={zones}
        />
      </div>

      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        className="hidden"
        onError={() => {
          void handleAudioError();
        }}
      />

      {/* Audio-Unlock-Button: nur im Preview-Modus sichtbar.
          Im Kiosk (cursor: none) wäre er unklickbar und würde Gäste
          irritieren — dort übernimmt der Auto-Retry-Loop oben. */}
      {isPreviewMode && isAudioBlocked && effectiveAudio.enabled && Boolean(effectiveAudioSourceUrl) && (
        <button
          onClick={() => {
            void tryPlayAudio();
          }}
          className="fixed bottom-6 right-6 z-50 px-4 py-2 rounded-lg bg-black/75 text-white text-sm hover:bg-black"
        >
          Audio in Vorschau aktivieren
        </button>
      )}

      {/* Slide Indicators — Container mit dunklem Backdrop, damit die
          Pillen auch über hellem Foto-Hintergrund aus 3-5 m sichtbar
          bleiben (vorher: bg-spa-surface/40 verschwand auf Dampf-weiß). */}
      {showSlideIndicators && totalSlides > 1 && !isModernDesign && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 backdrop-blur-sm"
          aria-label={`Slide ${currentSlideIndex + 1} von ${totalSlides}`}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={`slide-indicator-${i}`}
              className={classNames(
                'h-2 rounded-full transition-all',
                i === currentSlideIndex ? 'bg-white w-8' : 'bg-white/55 w-2',
              )}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Offline indicator (production) */}
      {!ENV_IS_DEV && !isConnected && !isPreviewMode && (
        <div
          className="fixed bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium z-50"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.85)', color: 'white' }}
          aria-live="polite"
        >
          <span className="w-2 h-2 rounded-full bg-spa-surface animate-pulse" />
          Offline
        </div>
      )}

      {/* Connection indicator (dev mode) - toggleable via showSlideIndicators */}
      {ENV_IS_DEV && showSlideIndicators && (
        <div
          data-snapshot-ignore="true"
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
