// Settings Types für Design/Theme System
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
  accentGreen?: string; // For Modern Wellness green accent
  statusLive?: string;
  statusNext?: string;
  statusPrestart?: string; // For "coming soon" status
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

export type DesignStyle = 'modern-wellness' | 'modern-timeline'; // Visual design styles
export type ColorPaletteName = 'standard-warm' | 'modern-spa' | 'dark' | 'fresh' | 'wellness-dark' | 'wellness-warm' | 'custom';

// Aroma/Scent for aufguss badges
export interface Aroma {
  id: string;
  emoji: string; // Visual representation (e.g., "🌿", "🍋", "❄️")
  name: string; // Name of the aroma (e.g., "Eukalyptus", "Zitrone", "Minze")
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
  imageId?: string; // Reference to media library
  startDate: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endDate?: string; // YYYY-MM-DD format (optional, defaults to startDate)
  endTime?: string; // HH:MM format (optional)
  assignedPreset: 'Evt1' | 'Evt2'; // Which event schedule to use
  isActive: boolean; // Enable/disable event
}

export interface Settings {
  version: number;
  designStyle?: DesignStyle; // Which visual design to use
  colorPalette?: ColorPaletteName; // Which color palette to use
  theme?: ThemeColors;
  fonts?: FontSettings;
  slides?: SlideSettings;
  display?: DisplaySettings;
  audio?: AudioSettings;
  header?: HeaderSettings;
  saunas?: Sauna[];
  slideshow?: SlideshowConfig;
  aromas?: Aroma[]; // Library of available aromas for aufguss
  infos?: InfoItem[]; // Info/tips shown in "Infos" slides
  events?: Event[]; // Special events with custom schedules
}

// Predefined Color Palettes (from old system)
export const COLOR_PALETTES: Array<{ id: ColorPaletteName; name: string; colors: Partial<ThemeColors> }> = [
  {
    id: 'standard-warm',
    name: 'Standard (Warm)',
    colors: {
      bg: '#E8DEBD',
      fg: '#5C3101',
      accent: '#D4A574',
      gridTable: '#D4A574',
      cellBg: '#F9F7F4',
      boxFg: '#2C2416',
      timeColBg: '#B8976A',
      flame: '#FF6B35',
      zebra1: '#F5EDD6',
      zebra2: '#E8DEBD',
      timeZebra1: '#C7AB7A',
      timeZebra2: '#B8976A',
      headRowBg: '#8B6F47',
      headRowFg: '#FFFFFF',
      cornerBg: '#6B5435',
      cornerFg: '#FFFFFF',
    },
  },
  {
    id: 'modern-spa',
    name: 'Modern (Spa)',
    colors: {
      bg: '#F9F7F4',
      fg: '#2C2416',
      accent: '#7FA99B',
      gridTable: '#A8C7BC',
      cellBg: '#FFFFFF',
      boxFg: '#2C2416',
      timeColBg: '#7FA99B',
      flame: '#FF8C61',
      zebra1: '#F9F7F4',
      zebra2: '#EDE9E3',
      timeZebra1: '#7FA99B',
      timeZebra2: '#5A7A70',
      headRowBg: '#8B6F47',
      headRowFg: '#FFFFFF',
      cornerBg: '#6B5435',
      cornerFg: '#FFFFFF',
    },
  },
  {
    id: 'dark',
    name: 'Dunkel',
    colors: {
      bg: '#2C2416',
      fg: '#F9F7F4',
      accent: '#D4A574',
      gridTable: '#5A4E3F',
      cellBg: '#3A3226',
      boxFg: '#F9F7F4',
      timeColBg: '#5A4E3F',
      flame: '#FF6B35',
      zebra1: '#3A3226',
      zebra2: '#2C2416',
      timeZebra1: '#6B5435',
      timeZebra2: '#5A4E3F',
      headRowBg: '#8B6F47',
      headRowFg: '#FFFFFF',
      cornerBg: '#B8976A',
      cornerFg: '#2C2416',
    },
  },
  {
    id: 'fresh',
    name: 'Hell & Frisch',
    colors: {
      bg: '#FFFFFF',
      fg: '#333333',
      accent: '#4CAF50',
      gridTable: '#81C784',
      cellBg: '#F5F5F5',
      boxFg: '#212121',
      timeColBg: '#A5D6A7',
      flame: '#FF5722',
      zebra1: '#FAFAFA',
      zebra2: '#F5F5F5',
      timeZebra1: '#C8E6C9',
      timeZebra2: '#A5D6A7',
      headRowBg: '#66BB6A',
      headRowFg: '#FFFFFF',
      cornerBg: '#388E3C',
      cornerFg: '#FFFFFF',
    },
  },
  {
    id: 'wellness-dark',
    name: 'Wellness Dark',
    colors: {
      bg: '#0c0b0a',
      fg: '#f4f1ea',
      accent: '#c5a059',
      gridTable: '#2a2622',
      cellBg: '#161412',
      boxFg: '#f4f1ea',
      timeColBg: '#c5a059',
      flame: '#FF6B35',
      zebra1: '#1a1816',
      zebra2: '#161412',
      timeZebra1: '#c5a059',
      timeZebra2: '#b8976a',
      headRowBg: '#2a2622',
      headRowFg: '#8e867a',
      cornerBg: '#161412',
      cornerFg: '#8e867a',
      // Dashboard specific
      dashboardBg: '#0c0b0a',
      cardBg: '#161412',
      cardBorder: '#2a2622',
      textMain: '#f4f1ea',
      textMuted: '#8e867a',
      accentGold: '#c5a059',
      statusLive: '#10B981',
      statusNext: '#c5a059',
    },
  },
  {
    id: 'wellness-warm',
    name: 'Wellness Warm (Modern)',
    colors: {
      bg: '#FDFBF7',
      fg: '#3E2723',
      accent: '#A68A64',
      gridTable: '#EBE5D3',
      cellBg: '#FFFFFF',
      boxFg: '#3E2723',
      timeColBg: '#8F9779',
      flame: '#FF6B35',
      zebra1: '#F7F3E9',
      zebra2: '#F2EDE1',
      timeZebra1: '#8F9779',
      timeZebra2: '#A68A64',
      headRowBg: '#F7F3E9',
      headRowFg: '#3E2723',
      cornerBg: '#8F9779',
      cornerFg: '#FFFFFF',
      // Dashboard specific - Modern Wellness Style
      dashboardBg: '#FDFBF7',
      cardBg: '#FFFFFF',
      cardBorder: '#EBE5D3',
      textMain: '#3E2723',
      textMuted: '#5D4037',
      accentGold: '#A68A64',
      accentGreen: '#8F9779',
      statusLive: '#10B981',
      statusNext: '#A68A64',
      statusPrestart: '#F59E0B',
    },
  },
];

// Helper to get color palette by ID
export function getColorPalette(id: ColorPaletteName): Partial<ThemeColors> {
  const palette = COLOR_PALETTES.find((p) => p.id === id);
  return palette?.colors || COLOR_PALETTES[0].colors;
}

// Helper to generate dashboard-specific colors from base colors
export function generateDashboardColors(baseColors: Partial<ThemeColors>): ThemeColors {
  const colors = { ...baseColors } as ThemeColors;

  // Generate dashboard-specific colors if not present
  if (!colors.dashboardBg) colors.dashboardBg = colors.bg;
  if (!colors.cardBg) colors.cardBg = colors.cellBg || colors.bg;
  if (!colors.cardBorder) colors.cardBorder = colors.gridTable;
  if (!colors.textMain) colors.textMain = colors.fg;
  if (!colors.textMuted) colors.textMuted = colors.headRowFg || colors.fg;
  if (!colors.accentGold) colors.accentGold = colors.accent;
  if (!colors.accentGreen) colors.accentGreen = colors.timeColBg || colors.accent;
  if (!colors.statusLive) colors.statusLive = '#10B981';
  if (!colors.statusNext) colors.statusNext = colors.accentGold || colors.accent;
  if (!colors.statusPrestart) colors.statusPrestart = '#F59E0B';

  return colors;
}

// Helper to get default settings
export function getDefaultSettings(): Settings {
  const paletteId: ColorPaletteName = 'wellness-warm';
  const paletteColors = getColorPalette(paletteId);
  return {
    version: 1,
    designStyle: 'modern-wellness',
    colorPalette: paletteId,
    theme: generateDashboardColors(paletteColors) as ThemeColors,
    fonts: {
      fontScale: 1,
      h1Scale: 1.5,
      h2Scale: 1.2,
      overviewTitleScale: 1,
      overviewHeadScale: 1,
      overviewCellScale: 1,
      overviewTimeScale: 1,
      overviewTimeWidthScale: 1,
      tileTextScale: 1,
      tileTimeScale: 1,
      tileTimeWeight: 600,
      metaTextScale: 1,
      metaHeadScale: 1,
      badgeTextScale: 0.85,
      flameScale: 1,
    },
    slides: {
      defaultDuration: 10,
      transitionDuration: 1,
      showClock: true,
      clockPosition: 'top-right',
    },
    display: {
      gridColumns: 3,
      gridGap: 16,
      showBadges: true,
      showSubtitles: true,
      compactMode: false,
    },
    audio: {
      enabled: false,
      volume: 0.5,
      loop: true,
    },
    header: {
      enabled: true,
      showLogo: true,
      logoText: 'Westfalenbad Hagen',
      showClock: true,
      showDate: true,
      subtitle: 'Saunawelt',
      height: 8,
    },
    aromas: [
      { id: '1', emoji: '🌿', name: 'Eukalyptus' },
      { id: '2', emoji: '🍋', name: 'Zitrone' },
      { id: '3', emoji: '❄️', name: 'Minze' },
      { id: '4', emoji: '🌸', name: 'Lavendel' },
      { id: '5', emoji: '🍊', name: 'Orange' },
      { id: '6', emoji: '🌲', name: 'Kiefer' },
      { id: '7', emoji: '🥥', name: 'Kokos' },
      { id: '8', emoji: '🌹', name: 'Rose' },
    ],
    infos: [
      {
        id: 'info-1',
        title: 'Wellness-Knigge',
        text: 'Bitte legen Sie immer ein ausreichend großes Handtuch unter den gesamten Körper.',
      },
      {
        id: 'info-2',
        title: 'Abkühlung',
        text: 'Nutzen Sie nach dem Saunagang unsere Kaltwasserbecken für den perfekten Kreislauf-Kick.',
      },
    ],
    events: [],
  };
}

// Helper to check if an event is currently active
export function isEventActive(event: Event, now: Date = new Date()): boolean {
  if (!event.isActive) return false;

  const startDateTime = new Date(`${event.startDate}T${event.startTime}`);
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const endDateTime = new Date(`${endDate}T${endTime}`);

  return now >= startDateTime && now <= endDateTime;
}

// Helper to get currently active event (if any)
export function getActiveEvent(settings: Settings, now: Date = new Date()): Event | null {
  if (!settings.events) return null;

  const activeEvents = settings.events
    .filter(event => isEventActive(event, now))
    .sort((a, b) => {
      // Sort by start time, most recent first
      const aStart = new Date(`${a.startDate}T${a.startTime}`);
      const bStart = new Date(`${b.startDate}T${b.startTime}`);
      return bStart.getTime() - aStart.getTime();
    });

  return activeEvents[0] || null;
}
