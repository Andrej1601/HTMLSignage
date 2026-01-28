import { useState, useEffect, useCallback } from 'react';
import type { SlideType, SlideConfig } from '@/types/display.types';
import type { Settings } from '@/types/settings.types';

interface UseSlideshowOptions {
  settings: Settings;
  enabled?: boolean;
}

export function useSlideshow({ settings, enabled = true }: UseSlideshowOptions) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Define slides configuration
  const slides: SlideConfig[] = [
    {
      type: 'overview',
      duration: settings.slides?.defaultDuration || 10,
    },
    {
      type: 'clock',
      duration: 5,
    },
  ];

  const currentSlide = slides[currentSlideIndex];

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index);
    }
  }, [slides.length]);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    setCurrentSlideIndex(0);
    setIsPaused(false);
  }, []);

  // Auto-advance slides
  useEffect(() => {
    if (!enabled || isPaused || !currentSlide) return;

    const duration = currentSlide.duration * 1000;
    const timer = setTimeout(() => {
      nextSlide();
    }, duration);

    return () => clearTimeout(timer);
  }, [enabled, isPaused, currentSlide, currentSlideIndex, nextSlide]);

  return {
    currentSlide: currentSlide.type,
    currentSlideIndex,
    totalSlides: slides.length,
    isPaused,
    nextSlide,
    prevSlide,
    goToSlide,
    pause,
    resume,
    reset,
  };
}
