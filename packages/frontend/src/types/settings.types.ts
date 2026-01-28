// Settings Types für Design/Theme System

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

export interface Settings {
  version: number;
  theme?: ThemeColors;
  fonts?: FontSettings;
  slides?: SlideSettings;
  display?: DisplaySettings;
  audio?: AudioSettings;
}

// Predefined Color Palettes (from old system)
export const COLOR_PALETTES: Array<{ name: string; colors: Partial<ThemeColors> }> = [
  {
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
];

// Helper to get default settings
export function getDefaultSettings(): Settings {
  return {
    version: 1,
    theme: COLOR_PALETTES[0].colors as ThemeColors,
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
  };
}
