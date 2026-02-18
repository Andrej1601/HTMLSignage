import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Settings } from '@/types/settings.types';
import {
  getEnabledSlides,
  createDefaultSlideshowConfig,
  getZonesForLayout,
  getSlidesByZone,
  shouldZoneRotate,
} from '@/types/slideshow.types';
import type { SlideConfig, Zone } from '@/types/slideshow.types';
import { ENV_IS_DEV } from '@/config/env';

interface UseSlideshowOptions {
  settings: Settings;
  enabled?: boolean;
}

interface ZoneSlidesState {
  zoneSlides: SlideConfig[];
  currentIndex: number;
  currentSlide: SlideConfig | null;
}

function getEnabledSlidesForZone(slides: SlideConfig[], zoneId: string): SlideConfig[] {
  return getSlidesByZone(slides, zoneId).filter((slide) => slide.enabled);
}

function normalizeSlideIndex(rawIndex: number | undefined, slideCount: number): number {
  if (slideCount <= 0) return 0;
  return Number.isFinite(rawIndex) ? (rawIndex as number) % slideCount : 0;
}

function getZoneSlidesState(
  slides: SlideConfig[],
  zoneId: string,
  zoneSlideIndexes: Record<string, number>,
): ZoneSlidesState {
  const zoneSlides = getEnabledSlidesForZone(slides, zoneId);
  const currentIndex = normalizeSlideIndex(zoneSlideIndexes[zoneId], zoneSlides.length);
  return {
    zoneSlides,
    currentIndex,
    currentSlide: zoneSlides[currentIndex] || null,
  };
}

export function useSlideshow({ settings, enabled = true }: UseSlideshowOptions) {
  const [isPaused, setIsPaused] = useState(false);

  // Get slideshow config from settings
  const slideshowConfig = useMemo(
    () => settings.slideshow || createDefaultSlideshowConfig(),
    [settings.slideshow]
  );
  // Important: memoize derived arrays so unrelated re-renders (e.g. pairing polling) don't reset timers.
  const slides = useMemo(() => getEnabledSlides(slideshowConfig), [slideshowConfig]);
  const zones = useMemo(() => getZonesForLayout(slideshowConfig.layout), [slideshowConfig.layout]);

  // Track current slide index per zone
  const [zoneSlideIndexes, setZoneSlideIndexes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    zones.forEach((zone) => {
      initial[zone.id] = 0;
    });
    return initial;
  });

  // Keep zone indexes in sync with current zones (e.g. when layout changes or settings load async).
  useEffect(() => {
    setZoneSlideIndexes((prev) => {
      let changed = false;
      const next: Record<string, number> = { ...prev };

      // Add missing zones and normalize invalid values (undefined/NaN).
      zones.forEach((zone) => {
        const current = next[zone.id];
        if (!Number.isFinite(current)) {
          next[zone.id] = 0;
          changed = true;
        }
      });

      // Remove zones that no longer exist.
      Object.keys(next).forEach((key) => {
        if (!zones.some((z) => z.id === key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [zones]);

  // Track video ended state per zone
  const videoEndedRefs = useRef<Record<string, boolean>>({});

  // Per-zone timers: zones must advance independently (a change in one zone must not reset others).
  const zoneTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const zoneTimerKeysRef = useRef<Record<string, string | undefined>>({});
  const lastTimerConfigRef = useRef<{ slides: SlideConfig[]; zones: Zone[]; defaultDuration: number } | null>(null);

  const clearAllZoneTimers = useCallback(() => {
    Object.values(zoneTimersRef.current).forEach((t) => {
      if (t) clearTimeout(t);
    });
    zoneTimersRef.current = {};
    zoneTimerKeysRef.current = {};
  }, []);

  // Ensure no timers leak on unmount.
  useEffect(() => clearAllZoneTimers, [clearAllZoneTimers]);

  // Legacy support: prefer the zone named "main" when present, otherwise use the first zone.
  const mainZone = zones.find((z) => z.id === 'main') || zones[0];
  const mainZoneSlides = mainZone ? getEnabledSlidesForZone(slides, mainZone.id) : slides;
  const currentSlideIndex = mainZone?.id
    ? normalizeSlideIndex(zoneSlideIndexes[mainZone.id], mainZoneSlides.length)
    : 0;
  const currentSlide = mainZoneSlides[currentSlideIndex] || null;

  const nextSlide = useCallback(
    (zoneId?: string) => {
      const targetZone = zoneId || mainZone?.id;
      if (!targetZone) return;

      const zoneSlides = getEnabledSlidesForZone(slides, targetZone);
      if (zoneSlides.length === 0) return;

      setZoneSlideIndexes((prev) => ({
        ...prev,
        [targetZone]: ((prev[targetZone] ?? 0) + 1) % zoneSlides.length,
      }));
      if (videoEndedRefs.current[targetZone]) {
        videoEndedRefs.current[targetZone] = false;
      }
    },
    [mainZone?.id, slides]
  );

  const prevSlide = useCallback(
    (zoneId?: string) => {
      const targetZone = zoneId || mainZone?.id;
      if (!targetZone) return;

      const zoneSlides = getEnabledSlidesForZone(slides, targetZone);
      if (zoneSlides.length === 0) return;

      setZoneSlideIndexes((prev) => ({
        ...prev,
        [targetZone]: ((prev[targetZone] ?? 0) - 1 + zoneSlides.length) % zoneSlides.length,
      }));
      if (videoEndedRefs.current[targetZone]) {
        videoEndedRefs.current[targetZone] = false;
      }
    },
    [mainZone?.id, slides]
  );

  const goToSlide = useCallback(
    (index: number, zoneId?: string) => {
      const targetZone = zoneId || mainZone?.id;
      if (!targetZone) return;

      const zoneSlides = getEnabledSlidesForZone(slides, targetZone);
      if (index >= 0 && index < zoneSlides.length) {
        setZoneSlideIndexes((prev) => ({
          ...prev,
          [targetZone]: index,
        }));
        if (videoEndedRefs.current[targetZone]) {
          videoEndedRefs.current[targetZone] = false;
        }
      }
    },
    [mainZone?.id, slides]
  );

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    const initial: Record<string, number> = {};
    zones.forEach((zone) => {
      initial[zone.id] = 0;
    });
    setZoneSlideIndexes(initial);
    setIsPaused(false);
    videoEndedRefs.current = {};
  }, [zones]);

  const onVideoEnded = useCallback(
    (zoneId?: string) => {
      const targetZone = zoneId || mainZone?.id;
      if (!targetZone) return;

      const { currentSlide: slide } = getZoneSlidesState(slides, targetZone, zoneSlideIndexes);

      if (slide?.type === 'media-video' && slide.videoPlayback === 'complete') {
        videoEndedRefs.current[targetZone] = true;
        // Advance immediately when video completes
        nextSlide(targetZone);
      }
    },
    [mainZone?.id, slides, zoneSlideIndexes, nextSlide]
  );

  // Debug logging for slide rotation
  useEffect(() => {
    if (!ENV_IS_DEV) return;

    const zonesDebug = zones.map((zone) => {
      const zoneSlides = getEnabledSlidesForZone(slides, zone.id);
      return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        slidesCount: zoneSlides.length,
        shouldRotate: shouldZoneRotate(zone, slides),
        slides: zoneSlides.map((s) => ({
          type: s.type,
          id: s.id,
          enabled: s.enabled,
          saunaId: s.saunaId || 'N/A',
          duration: s.duration,
        })),
      };
    });

    console.log('[useSlideshow] Layout:', slideshowConfig.layout);
    console.log('[useSlideshow] Total Slides:', slides.length);
    console.log('[useSlideshow] Zones:', zonesDebug);

    // Show rotation status clearly
    zonesDebug.forEach((zone) => {
      if (zone.slidesCount === 0) {
        console.warn(`[useSlideshow] Zone "${zone.name}" has NO slides!`);
      } else if (zone.slidesCount === 1) {
        console.warn(`[useSlideshow] Zone "${zone.name}" has only 1 slide - will NOT rotate`);
      } else {
        console.log(`[useSlideshow] Zone "${zone.name}" has ${zone.slidesCount} slides - will rotate`);
      }
    });
  }, [slideshowConfig.layout, slides, zones]);

  // Auto-advance slides per zone
  useEffect(() => {
    const isDev = ENV_IS_DEV;
    const clearZoneTimer = (zoneId: string) => {
      const existing = zoneTimersRef.current[zoneId];
      if (existing) clearTimeout(existing);
      delete zoneTimersRef.current[zoneId];
      delete zoneTimerKeysRef.current[zoneId];
    };

    const timerConfigChanged =
      !lastTimerConfigRef.current ||
      lastTimerConfigRef.current.slides !== slides ||
      lastTimerConfigRef.current.zones !== zones ||
      lastTimerConfigRef.current.defaultDuration !== (slideshowConfig.defaultDuration || 0);

    if (timerConfigChanged) {
      clearAllZoneTimers();
      lastTimerConfigRef.current = {
        slides,
        zones,
        defaultDuration: slideshowConfig.defaultDuration || 0,
      };
    }

    if (!enabled || isPaused || slides.length === 0) {
      clearAllZoneTimers();
      return;
    }

    zones.forEach((zone) => {
      const { currentSlide: slide } = getZoneSlidesState(slides, zone.id, zoneSlideIndexes);

      // Check if this zone should rotate
      if (!shouldZoneRotate(zone, slides)) {
        // Zone is static (smart-persistent with 1 slide or persistent type)
        clearZoneTimer(zone.id);
        return;
      }

      if (!slide) {
        clearZoneTimer(zone.id);
        return;
      }

      // For videos set to play until complete, wait for video to end
      if (
        slide.type === 'media-video' &&
        slide.videoPlayback === 'complete' &&
        !videoEndedRefs.current[zone.id]
      ) {
        clearZoneTimer(zone.id);
        return; // Don't set timer, wait for onVideoEnded
      }

      const durationSec = slide.duration || slideshowConfig.defaultDuration || 10; // Default to config/global duration
      const duration = durationSec * 1000;
      const timerKey = `${slide.id}:${duration}`;

      if (zoneTimerKeysRef.current[zone.id] === timerKey && zoneTimersRef.current[zone.id]) {
        // Timer already running for this zone+slide.
        return;
      }

      clearZoneTimer(zone.id);
      zoneTimerKeysRef.current[zone.id] = timerKey;
      if (isDev) {
        console.log(
          `[useSlideshow] Setting timer for zone "${zone.id}" with duration ${duration}ms (slide: ${slide.id})`
        );
      }
      zoneTimersRef.current[zone.id] = setTimeout(() => {
        if (isDev) {
          console.log(`[useSlideshow] Timer fired for zone "${zone.id}" - advancing to next slide`);
        }
        nextSlide(zone.id);
      }, duration);
    });

    // Remove timers for zones that no longer exist.
    Object.keys(zoneTimersRef.current).forEach((zoneId) => {
      if (!zones.some((z) => z.id === zoneId)) {
        clearZoneTimer(zoneId);
      }
    });
  }, [enabled, isPaused, slides, zones, zoneSlideIndexes, nextSlide, slideshowConfig.defaultDuration]);

  // Helper to get current slide for a zone
  const getZoneSlide = useCallback(
    (zoneId: string) => {
      const { currentSlide } = getZoneSlidesState(slides, zoneId, zoneSlideIndexes);
      return currentSlide;
    },
    [slides, zoneSlideIndexes]
  );

  // Helper to get zone info (slide count, should rotate, etc.)
  const getZoneInfo = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return null;

      const { zoneSlides, currentIndex, currentSlide } = getZoneSlidesState(slides, zoneId, zoneSlideIndexes);

      return {
        zone,
        currentSlide,
        currentSlideIndex: currentIndex,
        totalSlides: zoneSlides.length,
        shouldRotate: shouldZoneRotate(zone, slides),
      };
    },
    [zones, slides, zoneSlideIndexes]
  );

  return {
    // Legacy single-zone support (for backward compatibility)
    currentSlide,
    currentSlideIndex,
    totalSlides: mainZoneSlides.length,
    isPaused,
    layout: slideshowConfig.layout,
    persistentZonePosition: slideshowConfig.persistentZonePosition,
    persistentZoneSize: slideshowConfig.persistentZoneSize,
    enableTransitions: slideshowConfig.enableTransitions,
    showSlideIndicators: slideshowConfig.showSlideIndicators,
    showZoneBorders: slideshowConfig.showZoneBorders !== false,
    nextSlide,
    prevSlide,
    goToSlide,
    pause,
    resume,
    reset,
    onVideoEnded,
    // Multi-zone support
    zones,
    getZoneSlide,
    getZoneInfo,
  };
}
