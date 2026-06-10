/**
 * Migration utilities for slideshow configuration
 * Handles backward compatibility when property names change
 */

import type { Settings, ColorPaletteName, ThemeColors } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import { generateDashboardColors, getColorPalette } from '@/types/settings.types';
import {
  DEFAULT_DISPLAY_APPEARANCE,
  EDITORIAL_DISPLAY_APPEARANCE,
  MINERAL_NOIR_DISPLAY_APPEARANCE,
} from '@/config/displayDesignStyles';

const LEGACY_DESIGN_STYLE_MAP: Record<string, Settings['designStyle']> = {
  classic: 'modern-wellness',
  dashboard: 'modern-wellness',
  'modern-wellness': 'modern-wellness',
  'modern-timeline': 'modern-timeline',
  'compact-tiles': 'compact-tiles',
};

function resolveTargetAppearance(
  appearance: string | undefined | null,
  designStyle: string | undefined | null,
): Settings['displayAppearance'] {
  const norm = String(appearance || '').trim().toLowerCase();
  const styleNorm = String(designStyle || '').trim().toLowerCase();
  if (norm === EDITORIAL_DISPLAY_APPEARANCE || styleNorm === EDITORIAL_DISPLAY_APPEARANCE) {
    return EDITORIAL_DISPLAY_APPEARANCE;
  }
  if (norm === MINERAL_NOIR_DISPLAY_APPEARANCE) return MINERAL_NOIR_DISPLAY_APPEARANCE;
  return DEFAULT_DISPLAY_APPEARANCE;
}

function isThemeComplete(theme: Partial<ThemeColors> | undefined, palette: Partial<ThemeColors>): boolean {
  if (!theme) return false;
  // generateDashboardColors fills these — if they're all already present
  // in the existing theme, calling it again would just re-emit identical
  // values inside a brand new object. Skip the regeneration to keep the
  // returned settings reference-stable.
  for (const key of Object.keys(palette) as Array<keyof ThemeColors>) {
    if (theme[key] === undefined) return false;
  }
  // generateDashboardColors also fills these defaults regardless of palette
  const required: Array<keyof ThemeColors> = [
    'dashboardBg',
    'cardBg',
    'cardBorder',
    'textMain',
    'textMuted',
    'accentGold',
    'accentGreen',
    'statusLive',
    'statusNext',
    'statusPrestart',
  ];
  for (const key of required) {
    if (theme[key] === undefined) return false;
  }
  return true;
}

/**
 * Migrates old slideshow config to new naming conventions
 *
 * Changes:
 * - 'schedule-grid' slide type → 'content-panel'
 * - scheduleGridPosition → persistentZonePosition
 * - scheduleGridSize → persistentZoneSize
 *
 * Reference equality: when nothing actually needs migrating AND the
 * theme is already complete, the original `settings` object is
 * returned untouched. That keeps consumers' `useMemo` / `useEffect`
 * deps stable across calls — critical for the embedded preview, where
 * this runs on every postMessage and would otherwise reset the
 * slide-rotation timer.
 */
export function migrateSettings(settings: Partial<Settings>): Settings {
  // ── Display appearance / design style normalization ─────────────────────
  const targetDisplayAppearance = resolveTargetAppearance(
    settings.displayAppearance,
    settings.designStyle,
  );
  const targetDesignStyle =
    LEGACY_DESIGN_STYLE_MAP[String(settings.designStyle || '').trim().toLowerCase()] || 'modern-wellness';

  let displayAppearanceChanged = settings.displayAppearance !== targetDisplayAppearance;
  let designStyleChanged = settings.designStyle !== targetDesignStyle;

  // ── Events.settingsOverrides normalization ──────────────────────────────
  let eventsChanged = false;
  let normalizedEvents: typeof settings.events = settings.events;
  if (settings.events && Array.isArray(settings.events)) {
    let anyEventChanged = false;
    const next = settings.events.map((event) => {
      if (!event.settingsOverrides) return event;

      const overrides = event.settingsOverrides;
      const overrideStyle = String(overrides.designStyle || '').trim().toLowerCase();
      const overrideAppearance = String(overrides.displayAppearance || '').trim().toLowerCase();

      const targetOverrideAppearance =
        overrideAppearance === EDITORIAL_DISPLAY_APPEARANCE || overrideStyle === EDITORIAL_DISPLAY_APPEARANCE
          ? EDITORIAL_DISPLAY_APPEARANCE
          : overrideAppearance === MINERAL_NOIR_DISPLAY_APPEARANCE
            ? MINERAL_NOIR_DISPLAY_APPEARANCE
            : overrideAppearance === DEFAULT_DISPLAY_APPEARANCE
              ? DEFAULT_DISPLAY_APPEARANCE
              : undefined;
      const targetOverrideStyle = LEGACY_DESIGN_STYLE_MAP[overrideStyle];

      const appearanceWillChange =
        targetOverrideAppearance != null &&
        overrides.displayAppearance !== targetOverrideAppearance;
      const styleWillChange =
        (overrideStyle && !targetOverrideStyle) ||
        (Boolean(targetOverrideStyle) && overrides.designStyle !== targetOverrideStyle);

      if (!appearanceWillChange && !styleWillChange) return event;

      anyEventChanged = true;
      const nextOverrides = { ...overrides };
      if (appearanceWillChange) nextOverrides.displayAppearance = targetOverrideAppearance;
      if (overrideStyle && !targetOverrideStyle) {
        delete nextOverrides.designStyle;
      } else if (targetOverrideStyle) {
        nextOverrides.designStyle = targetOverrideStyle;
      }
      return { ...event, settingsOverrides: nextOverrides };
    });
    if (anyEventChanged) {
      eventsChanged = true;
      normalizedEvents = next;
    }
  }

  // ── Theme normalization ─────────────────────────────────────────────────
  const paletteId = settings.colorPalette || 'wellness-warm';
  const paletteColors = getColorPalette(paletteId as ColorPaletteName);
  // Only regenerate the theme if it's missing tokens. A fully-populated
  // theme is left as-is so the reference stays stable.
  let nextTheme: ThemeColors | undefined = settings.theme;
  let themeChanged = false;
  if (!isThemeComplete(settings.theme, paletteColors)) {
    nextTheme = generateDashboardColors({ ...paletteColors, ...(settings.theme || {}) });
    themeChanged = true;
  }

  // ── Slideshow normalization ─────────────────────────────────────────────
  let nextSlideshow: SlideshowConfig | undefined = settings.slideshow;
  let slideshowChanged = false;

  if (settings.slideshow) {
    const sourceShow = settings.slideshow as SlideshowConfig & Record<string, unknown>;
    const hasLegacyPosition = 'scheduleGridPosition' in sourceShow;
    const hasLegacySize = 'scheduleGridSize' in sourceShow;
    const hasLegacySlideType =
      Array.isArray(sourceShow.slides) &&
      sourceShow.slides.some(
        (s) => (s as unknown as Record<string, unknown>).type === 'schedule-grid',
      );

    if (hasLegacyPosition || hasLegacySize || hasLegacySlideType) {
      slideshowChanged = true;
      const cloned = { ...sourceShow } as SlideshowConfig & Record<string, unknown>;
      if (hasLegacyPosition) {
        cloned.persistentZonePosition = cloned.scheduleGridPosition as SlideshowConfig['persistentZonePosition'];
        delete cloned.scheduleGridPosition;
      }
      if (hasLegacySize) {
        cloned.persistentZoneSize = cloned.scheduleGridSize as number;
        delete cloned.scheduleGridSize;
      }
      if (hasLegacySlideType && Array.isArray(cloned.slides)) {
        cloned.slides = cloned.slides.map((slide) => {
          if ((slide as unknown as Record<string, unknown>).type === 'schedule-grid') {
            return { ...slide, type: 'content-panel' as const };
          }
          return slide;
        });
      }
      nextSlideshow = cloned as SlideshowConfig;
    }
  }

  // ── Short-circuit when no changes are needed ────────────────────────────
  // Returning the original `settings` reference matters: consumers
  // depend on `===` equality to short-circuit re-renders / effects.
  const versionFilled = typeof settings.version === 'number';
  if (
    versionFilled &&
    !displayAppearanceChanged &&
    !designStyleChanged &&
    !eventsChanged &&
    !themeChanged &&
    !slideshowChanged
  ) {
    return settings as Settings;
  }

  if (themeChanged || slideshowChanged) {
    console.log('[slideshowMigration] Migrated slideshow config from old format to new format');
  }

  return {
    ...settings,
    version: settings.version ?? 1,
    displayAppearance: displayAppearanceChanged ? targetDisplayAppearance : settings.displayAppearance,
    designStyle: designStyleChanged ? targetDesignStyle : settings.designStyle,
    events: eventsChanged ? normalizedEvents : settings.events,
    theme: themeChanged ? nextTheme : settings.theme,
    slideshow: slideshowChanged ? nextSlideshow : settings.slideshow,
  };
}
