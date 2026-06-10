// Settings Types für Design/Theme System
// Color palettes, generateDashboardColors, getDefaultSettings → @/types/theme.constants
// Re-exported here so existing imports don't need to change.
export { COLOR_PALETTES, getColorPalette, generateDashboardColors, getDefaultSettings } from './theme.constants';

import type { Sauna } from './sauna.types';
import type { SlideshowConfig } from './slideshow.types';

// Atomic union types now live in @htmlsignage/shared — re-exported here so
// existing FE imports keep working while having a single source of truth.
import type {
  ClockPosition,
  DisplayAppearance,
  DesignStyle,
  SaunaDetailStyle,
} from '@htmlsignage/shared/settings';

export type {
  ClockPosition,
  DisplayAppearance,
  DesignStyle,
  SaunaDetailStyle,
};

export interface ThemeColors {
  // ─── Canonical SDK color tokens ─────────────────────────────────────────
  // These are the 11 tokens every design pack consumes. The legacy fields
  // below remain for backwards compatibility (older settings, the legacy
  // schedule grid renderer); themeBridge prefers the SDK fields when set.
  surface?: string;          // Body / panel base — the stage colour
  surfaceElevated?: string;  // Cards, sub-panels (typically a notch lighter than surface)
  border?: string;           // Card borders, hairlines, dividers
  textPrimary?: string;      // Headlines, card titles, main copy
  textSecondary?: string;    // Labels, meta, sub-lines
  textInverse?: string;      // Text drawn on filled accent / status backgrounds
  accentPrimary?: string;    // Brand-leading accent (brass, gold, palette key colour)
  accentSecondary?: string;  // Counter-accent (moss, secondary brand tone)
  statusWarning?: string;    // Prestart / "GLEICH" pill colour
  accentStripe?: string;     // Optional: tint for the optional vertical accent-stripe overlay
  heroOverlay?: string;      // Optional: tint for the wash drawn over hero-variant background images

  // ─── Legacy fields (Pre-Design-Pack era) ────────────────────────────────
  // Background & Foreground
  bg: string;
  fg: string;
  accent: string;

  // Grid/Table Colors
  gridTable: string;
  cellBg: string;
  boxFg: string;
  timeColBg: string;

  // Special Colors
  flame: string;

  // Zebra Striping
  zebra1: string;
  zebra2: string;
  timeZebra1: string;
  timeZebra2: string;

  // Header Colors
  headRowBg: string;
  headRowFg: string;
  cornerBg: string;
  cornerFg: string;

  // Dashboard Theme Colors (for Wellness Dark & Modern Wellness designs)
  dashboardBg?: string;
  cardBg?: string;
  cardBorder?: string;
  textMain?: string;
  textMuted?: string;
  accentGold?: string;
  accentGreen?: string;
  statusLive?: string;
  statusNext?: string;
  statusPrestart?: string;
}

export interface FontSettings {
  fontScale?: number;
  h1Scale?: number;
  h2Scale?: number;
  overviewTitleScale?: number;
  overviewHeadScale?: number;
  overviewCellScale?: number;
  overviewTimeScale?: number;
  overviewTimeWidthScale?: number;
  tileTextScale?: number;
  tileTimeScale?: number;
  tileTimeWeight?: number;
  metaTextScale?: number;
  metaHeadScale?: number;
  badgeTextScale?: number;
  flameScale?: number;
}

export interface SlideSettings {
  defaultDuration?: number;
  transitionDuration?: number;
  showClock?: boolean;
  clockPosition?: import('@htmlsignage/shared/settings').ClockPosition;
}

export interface DisplaySettings {
  gridColumns?: number;
  gridGap?: number;
  showBadges?: boolean;
  showSubtitles?: boolean;
  compactMode?: boolean;
  prestartMinutes?: number;
  /**
   * Opt-in to the new design-pack rendering path. When unset or false,
   * the legacy display components remain authoritative. Scoped per
   * device via the standard settings-override mechanism.
   */
  useDesignPacks?: boolean;
  /**
   * Optional design-pack identifier. When `useDesignPacks` is true and
   * this is set to a known design id, that pack is used; otherwise the
   * host falls back to the default design.
   */
  designPackId?: string;
  /**
   * How aufguss intensity renders across packs.
   *   - 'flames' (default) — four flame icons filled up to the level
   *   - 'roman'            — single Roman numeral in a brass ring
   * The pack may ignore the hint; canonical behaviour is implemented
   * by every stable Aurora / Editorial / Wellness pack.
   */
  intensityDisplay?: 'flames' | 'roman';
  /**
   * Wenn true: Jeder Slide-Renderer bekommt einen vertikalen Akzentstreifen
   * am linken Rand in der Pack-Hauptfarbe (`tokens.colors.accentPrimary`).
   * Optik analog zum Mineral-Noir-Panel-Style. Pack-agnostisch — die Farbe
   * kommt vom aktiven Pack, der Streifen ist immer derselbe.
   */
  accentStripes?: boolean;
  /**
   * Multiplier für die Stärke des Hero-Wash über Hintergrundbildern
   * (Aufguss-Fokus „Hero"). `1` = Pack-Standard, `< 1` = heller (mehr
   * Foto sichtbar), `> 1` = dunkler. Sinnvoller Range: 0.5 – 1.5.
   */
  heroOverlayIntensity?: number;
}

export interface AudioSettings {
  enabled: boolean;
  src?: string;
  mediaId?: string;
  volume: number;
  loop: boolean;
}

export interface HeaderSettings {
  enabled: boolean;
  showLogo: boolean;
  logoText?: string;
  /**
   * Optional media id for a brand-image logo. When set, displays render
   * this image (via `getMediaUploadUrl`) instead of the two-tone
   * `logoText`. Keeping `logoText` as a fallback means screens still
   * show something meaningful if the image can't be resolved.
   */
  logoImageId?: string;
  showClock: boolean;
  showDate: boolean;
  subtitle?: string;
  height?: number; // percentage of screen height (default: 8)
}

export interface MaintenanceScreenSettings {
  label?: string;
  headline?: string;
  message?: string;
  showDeviceName?: boolean;
  backgroundImageId?: string;
  displayStyle?: 'glass' | 'overlay';
}

// DesignStyle, DisplayAppearance, SaunaDetailStyle are re-exported from
// @htmlsignage/shared at the top of this file (single source of truth).
export type BuiltinPaletteName =
  | 'standard-warm'
  | 'modern-spa'
  | 'dark'
  | 'fresh'
  | 'wellness-dark'
  | 'wellness-warm'
  | 'ocean-breeze'
  | 'alpine-wood'
  | 'aufguss-ritual'
  | 'aurora-thermal'
  | 'mineral-noir';

// Includes built-in palette IDs and custom palette IDs (cuid strings)
export type ColorPaletteName = BuiltinPaletteName | (string & {});

// Aroma/Scent for aufguss badges
export interface Aroma {
  id: string;
  emoji: string;
  name: string;
  color?: string; // hex color for badge, e.g. '#059669'
}

// 12 distinguishable colors for aroma badges (used as fallback when no color is set)
export const AROMA_COLOR_PALETTE = [
  '#059669', // emerald
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0284c7', // sky
  '#16a34a', // green
  '#ea580c', // orange
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#ca8a04', // yellow
  '#9333ea', // purple
  '#dc2626', // red
] as const;

/** Returns inline-style colors for an aroma badge. */
export function getAromaDisplayColor(hex: string): {
  bg: string; text: string; border: string;
} {
  return {
    bg: `${hex}18`,
    text: hex,
    border: `${hex}40`,
  };
}

/** Resolve a badge name to its aroma metadata + palette index. */
export function resolveAromaForBadge(
  badgeName: string,
  aromas: Aroma[],
): { emoji: string; name: string; color: string; index: number } {
  const cleaned = badgeName.trim();
  const idx = aromas.findIndex((a) => a.name.toLowerCase() === cleaned.toLowerCase());
  if (idx >= 0) {
    const a = aromas[idx];
    return {
      emoji: a.emoji,
      name: a.name,
      color: a.color || AROMA_COLOR_PALETTE[idx % AROMA_COLOR_PALETTE.length],
      index: idx,
    };
  }
  // Unknown aroma — hash name to pick a stable palette color
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) hash = (hash * 31 + cleaned.charCodeAt(i)) | 0;
  const fallbackIdx = Math.abs(hash) % AROMA_COLOR_PALETTE.length;
  return { emoji: '', name: cleaned, color: AROMA_COLOR_PALETTE[fallbackIdx], index: -1 };
}

// Info item (wellness tip / house rule / notice) shown in display.
export interface InfoItem {
  id: string;
  title: string;
  text: string;
  imageId?: string;
  imageMode?: 'thumbnail' | 'background';
}

// Event for special occasions
export interface Event {
  id: string;
  name: string;
  description?: string;
  imageId?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endDate?: string;
  endTime?: string;
  assignedPreset: 'Evt1' | 'Evt2';
  isActive: boolean;
  targetDeviceIds?: string[];
  slideshowId?: string; // Reference to a Slideshow entity (replaces inline overrides)

  /** @deprecated Use slideshowId instead. Kept for backward compat with existing events. */
  settingsOverrides?: EventSettingsOverrides;
}

/** @deprecated Use SlideshowConfig design fields + slideshowId on Event instead. */
export interface EventSettingsOverrides {
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  colorPalette?: ColorPaletteName;
  theme?: Partial<ThemeColors>;
  fonts?: Partial<FontSettings>;
  slides?: Partial<SlideSettings>;
  display?: Partial<DisplaySettings>;
  header?: Partial<HeaderSettings>;
  slideshow?: SlideshowConfig;
  audio?: AudioSettings;
}

export interface Settings {
  version: number;
  displayAppearance?: DisplayAppearance;
  designStyle?: DesignStyle;
  /** Visual variant for sauna-detail slides. Defaults to `split`. */
  saunaDetailStyle?: SaunaDetailStyle;
  colorPalette?: ColorPaletteName;
  theme?: ThemeColors;
  fonts?: FontSettings;
  slides?: SlideSettings;
  display?: DisplaySettings;
  audio?: AudioSettings;
  header?: HeaderSettings;
  maintenanceScreen?: MaintenanceScreenSettings;
  saunas?: Sauna[];
  slideshow?: SlideshowConfig;
  aromas?: Aroma[];
  infos?: InfoItem[];
  events?: Event[];
}

// ─── Event helpers ──────────────────────────────────────────────────────────
// Pure event logic lives in @htmlsignage/shared. We re-export and adapt
// signatures so existing FE callers (which pass FE-typed Settings/Event)
// keep working — the shared helpers accept structurally compatible values.

import {
  isEventActive as sharedIsEventActive,
  eventTargetsDevice as sharedEventTargetsDevice,
  getActiveEvent as sharedGetActiveEvent,
  type EventEntry,
} from '@htmlsignage/shared/settings';

export function isEventActive(event: Event, now: Date = new Date()): boolean {
  return sharedIsEventActive(event as unknown as EventEntry, now);
}

export function eventTargetsDevice(event: Event, deviceId?: string | null): boolean {
  return sharedEventTargetsDevice(event as unknown as EventEntry, deviceId);
}

export function getActiveEvent(
  settings: Settings,
  now: Date = new Date(),
  deviceId?: string | null,
): Event | null {
  const result = sharedGetActiveEvent(
    { events: settings.events as unknown as EventEntry[] | undefined },
    now,
    deviceId,
  );
  return result as unknown as Event | null;
}
