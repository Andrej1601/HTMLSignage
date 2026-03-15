/**
 * Migration utilities for slideshow configuration
 * Handles backward compatibility when property names change
 */

import type { Settings, ColorPaletteName } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import { generateDashboardColors, getColorPalette } from '@/types/settings.types';
import {
  DEFAULT_DISPLAY_APPEARANCE,
  EDITORIAL_DISPLAY_APPEARANCE,
} from '@/config/displayDesignStyles';

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
    'compact-tiles': 'compact-tiles',
  };
  const normalizedAppearance = String(next.displayAppearance || '').trim().toLowerCase();
  const targetDisplayAppearance =
    normalizedAppearance === EDITORIAL_DISPLAY_APPEARANCE || normalizedStyle === EDITORIAL_DISPLAY_APPEARANCE
      ? EDITORIAL_DISPLAY_APPEARANCE
      : DEFAULT_DISPLAY_APPEARANCE;
  const targetDesignStyle = legacyStyleMap[normalizedStyle] || 'modern-wellness';

  if (next.displayAppearance !== targetDisplayAppearance) {
    next.displayAppearance = targetDisplayAppearance;
    migrated = true;
  }
  if (next.designStyle !== targetDesignStyle) {
    next.designStyle = targetDesignStyle;
    migrated = true;
  }

  if (next.events && Array.isArray(next.events)) {
    next.events = next.events.map((event) => {
      if (!event.settingsOverrides) return event;

      const overrides = { ...event.settingsOverrides };
      const overrideStyle = String(overrides.designStyle || '').trim().toLowerCase();
      const overrideAppearance = String(overrides.displayAppearance || '').trim().toLowerCase();

      const targetOverrideAppearance =
        overrideAppearance === EDITORIAL_DISPLAY_APPEARANCE || overrideStyle === EDITORIAL_DISPLAY_APPEARANCE
          ? EDITORIAL_DISPLAY_APPEARANCE
          : overrideAppearance === DEFAULT_DISPLAY_APPEARANCE
            ? DEFAULT_DISPLAY_APPEARANCE
            : undefined;

      const targetOverrideStyle = legacyStyleMap[overrideStyle];

      if (targetOverrideAppearance && overrides.displayAppearance !== targetOverrideAppearance) {
        overrides.displayAppearance = targetOverrideAppearance;
        migrated = true;
      }

      if (overrideStyle && !targetOverrideStyle) {
        delete overrides.designStyle;
        migrated = true;
      } else if (targetOverrideStyle && overrides.designStyle !== targetOverrideStyle) {
        overrides.designStyle = targetOverrideStyle;
        migrated = true;
      }

      return {
        ...event,
        settingsOverrides: overrides,
      };
    });
  }

  // Ensure theme contains all design tokens needed by the modern display.
  // Preserve user overrides in `settings.theme`, but fill missing values from the selected palette.
  const paletteId = next.colorPalette || 'wellness-warm';
  const paletteColors = getColorPalette(paletteId as ColorPaletteName);
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
    const legacy = slideshow as Record<string, unknown>;
    (slideshow as SlideshowConfig).persistentZonePosition = legacy.scheduleGridPosition as SlideshowConfig['persistentZonePosition'];
    delete legacy.scheduleGridPosition;
    migrated = true;
  }

  if ('scheduleGridSize' in slideshow) {
    const legacy = slideshow as Record<string, unknown>;
    (slideshow as SlideshowConfig).persistentZoneSize = legacy.scheduleGridSize as number;
    delete legacy.scheduleGridSize;
    migrated = true;
  }

  // Migrate slide types
  if (slideshow.slides && Array.isArray(slideshow.slides)) {
    slideshow.slides = slideshow.slides.map(slide => {
      // Use any cast to compare with old string value that no longer exists in type
      if ((slide as unknown as Record<string, unknown>).type === 'schedule-grid') {
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
