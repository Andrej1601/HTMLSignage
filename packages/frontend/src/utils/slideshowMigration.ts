/**
 * Migration utilities for slideshow configuration
 * Handles backward compatibility when property names change
 */

import type { Settings } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';

/**
 * Migrates old slideshow config to new naming conventions
 *
 * Changes:
 * - 'schedule-grid' slide type → 'content-panel'
 * - scheduleGridPosition → persistentZonePosition
 * - scheduleGridSize → persistentZoneSize
 */
export function migrateSettings(settings: Settings): Settings {
  if (!settings.slideshow) {
    return settings;
  }

  const slideshow = { ...settings.slideshow };
  let migrated = false;

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
    ...settings,
    slideshow: slideshow as SlideshowConfig,
  };
}
