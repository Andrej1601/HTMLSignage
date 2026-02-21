// Settings Types für Design/Theme System
// Color palettes, generateDashboardColors, getDefaultSettings → @/types/theme.constants
// Re-exported here so existing imports don't need to change.
export { COLOR_PALETTES, getColorPalette, generateDashboardColors, getDefaultSettings } from './theme.constants';

import type { Sauna } from './sauna.types';
import type { SlideshowConfig } from './slideshow.types';

export interface ThemeColors {
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
  clockPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface DisplaySettings {
  gridColumns?: number;
  gridGap?: number;
  showBadges?: boolean;
  showSubtitles?: boolean;
  compactMode?: boolean;
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
  showClock: boolean;
  showDate: boolean;
  subtitle?: string;
  height?: number; // percentage of screen height (default: 8)
}

export type DesignStyle = 'modern-wellness' | 'modern-timeline';
export type ColorPaletteName =
  | 'standard-warm'
  | 'modern-spa'
  | 'dark'
  | 'fresh'
  | 'wellness-dark'
  | 'wellness-warm'
  | 'custom';

// Aroma/Scent for aufguss badges
export interface Aroma {
  id: string;
  emoji: string;
  name: string;
}

// Info item (wellness tip / house rule / notice) shown in display.
export interface InfoItem {
  id: string;
  title: string;
  text: string;
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
  settingsOverrides?: EventSettingsOverrides;
}

export interface EventSettingsOverrides {
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
  designStyle?: DesignStyle;
  colorPalette?: ColorPaletteName;
  theme?: ThemeColors;
  fonts?: FontSettings;
  slides?: SlideSettings;
  display?: DisplaySettings;
  audio?: AudioSettings;
  header?: HeaderSettings;
  saunas?: Sauna[];
  slideshow?: SlideshowConfig;
  aromas?: Aroma[];
  infos?: InfoItem[];
  events?: Event[];
}

// ─── Event helpers ───────────────────────────────────────────────────────────

export function isEventActive(event: Event, now: Date = new Date()): boolean {
  if (!event.isActive) return false;
  const startDateTime = new Date(`${event.startDate}T${event.startTime}`);
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const endDateTime = new Date(`${endDate}T${endTime}`);
  return now >= startDateTime && now <= endDateTime;
}

export function getActiveEvent(settings: Settings, now: Date = new Date()): Event | null {
  if (!settings.events) return null;
  const activeEvents = settings.events
    .filter((event) => isEventActive(event, now))
    .sort((a, b) => {
      const aStart = new Date(`${a.startDate}T${a.startTime}`);
      const bStart = new Date(`${b.startDate}T${b.startTime}`);
      return bStart.getTime() - aStart.getTime();
    });
  return activeEvents[0] || null;
}
