/**
 * Migration utilities for slideshow configuration
 * Handles backward compatibility when property names change
 */

import type { Settings } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import { generateDashboardColors, getColorPalette } from '@/types/settings.types';

/**
 * Migrates old slideshow config to new naming conventions
 *
 * Changes:
 * - 'schedule-grid' slide type → 'content-panel'
 * - scheduleGridPosition → persistentZonePosition
 * - scheduleGridSize → persistentZoneSize
 */
export function migrateSettings(settings: Settings): Settings {
  let migrated = false;
  const next: Settings = { ...settings };

  // Normalize legacy/unknown design styles while allowing current styles.
  const normalizedStyle = String(next.designStyle || '').trim().toLowerCase();
  const legacyStyleMap: Record<string, Settings['designStyle']> = {
    classic: 'modern-wellness',
    dashboard: 'modern-wellness',
    'modern-wellness': 'modern-wellness',
    'modern-timeline': 'modern-timeline',
  };
  const targetDesignStyle = legacyStyleMap[normalizedStyle] || 'modern-wellness';
  if (next.designStyle !== targetDesignStyle) {
    next.designStyle = targetDesignStyle;
    migrated = true;
  }

  // Ensure theme contains all design tokens needed by the modern display.
  // Preserve user overrides in `settings.theme`, but fill missing values from the selected palette.
  const paletteId = next.colorPalette || 'wellness-warm';
  const paletteColors = getColorPalette(paletteId as any);
  next.theme = generateDashboardColors({ ...paletteColors, ...(next.theme || {}) });

  if (!next.slideshow) {
    if (migrated) {
      console.log('[slideshowMigration] Normalized settings (design/theme)');
    }
    return next;
  }

  const slideshow = { ...next.slideshow };

  // Migrate property names
  if ('scheduleGridPosition' in slideshow) {
    (slideshow as any).persistentZonePosition = (slideshow as any).scheduleGridPosition;
    delete (slideshow as any).scheduleGridPosition;
    migrated = true;
  }

  if ('scheduleGridSize' in slideshow) {
    (slideshow as any).persistentZoneSize = (slideshow as any).scheduleGridSize;
    delete (slideshow as any).scheduleGridSize;
    migrated = true;
  }

  // Migrate slide types
  if (slideshow.slides && Array.isArray(slideshow.slides)) {
    slideshow.slides = slideshow.slides.map(slide => {
      // Use any cast to compare with old string value that no longer exists in type
      if ((slide as any).type === 'schedule-grid') {
        migrated = true;
        return { ...slide, type: 'content-panel' as const };
      }
      return slide;
    });
  }

  if (migrated) {
    console.log('[slideshowMigration] Migrated slideshow config from old format to new format');
  }

  return {
    ...next,
    slideshow: slideshow as SlideshowConfig,
  };
}
