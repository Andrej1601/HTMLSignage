import { useState, useEffect, useCallback, useRef } from 'react';
import type { Settings } from '@/types/settings.types';
import {
  getEnabledSlides,
  createDefaultSlideshowConfig,
  getZonesForLayout,
  getSlidesByZone,
  shouldZoneRotate,
} from '@/types/slideshow.types';

interface UseSlideshowOptions {
  settings: Settings;
  enabled?: boolean;
}

export function useSlideshow({ settings, enabled = true }: UseSlideshowOptions) {
  const [isPaused, setIsPaused] = useState(false);

  // Get slideshow config from settings
  const slideshowConfig = settings.slideshow || createDefaultSlideshowConfig();
  const slides = getEnabledSlides(slideshowConfig);
  const zones = getZonesForLayout(slideshowConfig.layout);

  // Track current slide index per zone
  const [zoneSlideIndexes, setZoneSlideIndexes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    zones.forEach((zone) => {
      initial[zone.id] = 0;
    });
    return initial;
  });

  // Track video ended state per zone
  const videoEndedRefs = useRef<Record<string, boolean>>({});

  // Legacy support: for single-zone layouts, use first zone
  const mainZone = zones[0];
  const currentSlideIndex = zoneSlideIndexes[mainZone?.id] || 0;
  const mainZoneSlides = mainZone ? getSlidesByZone(slides, mainZone.id).filter((s) => s.enabled) : slides;
  const currentSlide = mainZoneSlides[currentSlideIndex] || null;

  const nextSlide = useCallback(
    (zoneId?: string) => {
      const targetZone = zoneId || mainZone?.id;
      if (!targetZone) return;

      const zoneSlides = getSlidesByZone(slides, targetZone).filter((s) => s.enabled);
      if (zoneSlides.length === 0) return;

      setZoneSlideIndexes((prev) => ({
        ...prev,
        [targetZone]: (prev[targetZone] + 1) % zoneSlides.length,
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

      const zoneSlides = getSlidesByZone(slides, targetZone).filter((s) => s.enabled);
      if (zoneSlides.length === 0) return;

      setZoneSlideIndexes((prev) => ({
        ...prev,
        [targetZone]: (prev[targetZone] - 1 + zoneSlides.length) % zoneSlides.length,
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

      const zoneSlides = getSlidesByZone(slides, targetZone).filter((s) => s.enabled);
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

      const zoneSlides = getSlidesByZone(slides, targetZone).filter((s) => s.enabled);
      const currentIndex = zoneSlideIndexes[targetZone] || 0;
      const slide = zoneSlides[currentIndex];

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
    const zonesDebug = zones.map((zone) => {
      const zoneSlides = getSlidesByZone(slides, zone.id).filter((s) => s.enabled);
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
        console.warn(`⚠️ Zone "${zone.name}" has NO slides!`);
      } else if (zone.slidesCount === 1) {
        console.warn(`⚠️ Zone "${zone.name}" has only 1 slide - will NOT rotate (smart-persistent)`);
      } else {
        console.log(`✅ Zone "${zone.name}" has ${zone.slidesCount} slides - will rotate`);
      }
    });
  }, [slideshowConfig.layout, slides, zones]);

  // Auto-advance slides per zone
  useEffect(() => {
    if (!enabled || isPaused || slides.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    zones.forEach((zone) => {
      const zoneSlides = getSlidesByZone(slides, zone.id).filter((s) => s.enabled);

      // Check if this zone should rotate
      if (!shouldZoneRotate(zone, slides)) {
        // Zone is static (smart-persistent with 1 slide or persistent type)
        return;
      }

      const currentIndex = zoneSlideIndexes[zone.id] || 0;
      const slide = zoneSlides[currentIndex];

      if (!slide) return;

      // For videos set to play until complete, wait for video to end
      if (
        slide.type === 'media-video' &&
        slide.videoPlayback === 'complete' &&
        !videoEndedRefs.current[zone.id]
      ) {
        return; // Don't set timer, wait for onVideoEnded
      }

      const duration = (slide.duration || 10) * 1000; // Default to 10 seconds if not set
      console.log(`[useSlideshow] Setting timer for zone "${zone.id}" with duration ${duration}ms (slide: ${slide.id})`);
      const timer = setTimeout(() => {
        console.log(`[useSlideshow] Timer fired for zone "${zone.id}" - advancing to next slide`);
        nextSlide(zone.id);
      }, duration);

      timers.push(timer);
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [enabled, isPaused, slides, zones, zoneSlideIndexes, nextSlide]);

  // Helper to get current slide for a zone
  const getZoneSlide = useCallback(
    (zoneId: string) => {
      const zoneSlides = getSlidesByZone(slides, zoneId).filter((s) => s.enabled);
      const index = zoneSlideIndexes[zoneId] || 0;
      return zoneSlides[index] || null;
    },
    [slides, zoneSlideIndexes]
  );

  // Helper to get zone info (slide count, should rotate, etc.)
  const getZoneInfo = useCallback(
    (zoneId: string) => {
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return null;

      const zoneSlides = getSlidesByZone(slides, zoneId).filter((s) => s.enabled);
      const currentIndex = zoneSlideIndexes[zoneId] || 0;

      return {
        zone,
        currentSlide: zoneSlides[currentIndex] || null,
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
