/**
 * Theme color palettes, palette helpers, and default settings factory.
 * Separated from settings.types.ts to keep that file pure type definitions.
 */
import type { ColorPaletteName, ThemeColors, Settings } from './settings.types';
import { DEFAULT_MAINTENANCE_SCREEN_SETTINGS } from '@/config/maintenanceScreen';

// ─── Color Palettes ──────────────────────────────────────────────────────────

export const COLOR_PALETTES: Array<{ id: ColorPaletteName; name: string; colors: Partial<ThemeColors> }> = [
  {
    id: 'standard-warm',
    name: 'Standard (Warm)',
    colors: {
      bg: '#E8DEBD', fg: '#5C3101', accent: '#D4A574',
      gridTable: '#D4A574', cellBg: '#F9F7F4', boxFg: '#2C2416', timeColBg: '#B8976A',
      flame: '#FF6B35', zebra1: '#F5EDD6', zebra2: '#E8DEBD',
      timeZebra1: '#C7AB7A', timeZebra2: '#B8976A',
      headRowBg: '#8B6F47', headRowFg: '#FFFFFF', cornerBg: '#6B5435', cornerFg: '#FFFFFF',
      dashboardBg: '#E8DEBD', cardBg: '#F9F7F4', cardBorder: '#D4A574',
      textMain: '#5C3101', textMuted: '#7A4A1F', accentGold: '#D4A574', accentGreen: '#B8976A',
      statusLive: '#10B981', statusNext: '#D4A574', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'modern-spa',
    name: 'Modern (Spa)',
    colors: {
      bg: '#F9F7F4', fg: '#2C2416', accent: '#7FA99B',
      gridTable: '#A8C7BC', cellBg: '#FFFFFF', boxFg: '#2C2416', timeColBg: '#7FA99B',
      flame: '#FF8C61', zebra1: '#F9F7F4', zebra2: '#EDE9E3',
      timeZebra1: '#7FA99B', timeZebra2: '#5A7A70',
      headRowBg: '#8B6F47', headRowFg: '#FFFFFF', cornerBg: '#6B5435', cornerFg: '#FFFFFF',
      dashboardBg: '#F9F7F4', cardBg: '#FFFFFF', cardBorder: '#A8C7BC',
      textMain: '#2C2416', textMuted: '#5A7A70', accentGold: '#7FA99B', accentGreen: '#5A7A70',
      statusLive: '#10B981', statusNext: '#7FA99B', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'dark',
    name: 'Dunkel',
    colors: {
      bg: '#2C2416', fg: '#F9F7F4', accent: '#D4A574',
      gridTable: '#5A4E3F', cellBg: '#3A3226', boxFg: '#F9F7F4', timeColBg: '#5A4E3F',
      flame: '#FF6B35', zebra1: '#3A3226', zebra2: '#2C2416',
      timeZebra1: '#6B5435', timeZebra2: '#5A4E3F',
      headRowBg: '#8B6F47', headRowFg: '#FFFFFF', cornerBg: '#B8976A', cornerFg: '#2C2416',
      dashboardBg: '#2C2416', cardBg: '#3A3226', cardBorder: '#5A4E3F',
      textMain: '#F9F7F4', textMuted: '#C7B9A3', accentGold: '#D4A574', accentGreen: '#8B6F47',
      statusLive: '#10B981', statusNext: '#D4A574', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'fresh',
    name: 'Hell & Frisch',
    colors: {
      bg: '#FFFFFF', fg: '#333333', accent: '#4CAF50',
      gridTable: '#81C784', cellBg: '#F5F5F5', boxFg: '#212121', timeColBg: '#A5D6A7',
      flame: '#FF5722', zebra1: '#FAFAFA', zebra2: '#F5F5F5',
      timeZebra1: '#C8E6C9', timeZebra2: '#A5D6A7',
      headRowBg: '#66BB6A', headRowFg: '#FFFFFF', cornerBg: '#388E3C', cornerFg: '#FFFFFF',
      dashboardBg: '#FFFFFF', cardBg: '#F5F5F5', cardBorder: '#81C784',
      textMain: '#333333', textMuted: '#4E6B56', accentGold: '#4CAF50', accentGreen: '#388E3C',
      statusLive: '#10B981', statusNext: '#4CAF50', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'wellness-dark',
    name: 'Wellness Dark',
    colors: {
      bg: '#0c0b0a', fg: '#f4f1ea', accent: '#c5a059',
      gridTable: '#2a2622', cellBg: '#161412', boxFg: '#f4f1ea', timeColBg: '#c5a059',
      flame: '#FF6B35', zebra1: '#1a1816', zebra2: '#161412',
      timeZebra1: '#c5a059', timeZebra2: '#b8976a',
      headRowBg: '#2a2622', headRowFg: '#8e867a', cornerBg: '#161412', cornerFg: '#8e867a',
      dashboardBg: '#0c0b0a', cardBg: '#161412', cardBorder: '#2a2622',
      textMain: '#f4f1ea', textMuted: '#8e867a', accentGold: '#c5a059', accentGreen: '#8e867a',
      statusLive: '#10B981', statusNext: '#c5a059', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'wellness-warm',
    name: 'Wellness Warm (Modern)',
    colors: {
      bg: '#FDFBF7', fg: '#3E2723', accent: '#A68A64',
      gridTable: '#EBE5D3', cellBg: '#FFFFFF', boxFg: '#3E2723', timeColBg: '#8F9779',
      flame: '#FF6B35', zebra1: '#F7F3E9', zebra2: '#F2EDE1',
      timeZebra1: '#8F9779', timeZebra2: '#A68A64',
      headRowBg: '#F7F3E9', headRowFg: '#3E2723', cornerBg: '#8F9779', cornerFg: '#FFFFFF',
      dashboardBg: '#FDFBF7', cardBg: '#FFFFFF', cardBorder: '#EBE5D3',
      textMain: '#3E2723', textMuted: '#5D4037', accentGold: '#A68A64', accentGreen: '#8F9779',
      statusLive: '#10B981', statusNext: '#A68A64', statusPrestart: '#F59E0B',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    colors: {
      bg: '#EFF6FA', fg: '#1B3A4B', accent: '#3A8FB7',
      gridTable: '#7BB8D0', cellBg: '#FFFFFF', boxFg: '#1B3A4B', timeColBg: '#3A8FB7',
      flame: '#F28C38', zebra1: '#F5FAFD', zebra2: '#EAF4F9',
      timeZebra1: '#3A8FB7', timeZebra2: '#2D7A9F',
      headRowBg: '#2B6880', headRowFg: '#FFFFFF', cornerBg: '#1B4F66', cornerFg: '#FFFFFF',
      dashboardBg: '#EFF6FA', cardBg: '#FFFFFF', cardBorder: '#B8D9E8',
      textMain: '#1B3A4B', textMuted: '#4A7C90', accentGold: '#3A8FB7', accentGreen: '#2A9D8F',
      statusLive: '#2A9D8F', statusNext: '#3A8FB7', statusPrestart: '#F28C38',
    },
  },
  {
    id: 'alpine-wood',
    name: 'Alpine Holz',
    colors: {
      bg: '#F5F0EB', fg: '#3B2F2F', accent: '#8B5E3C',
      gridTable: '#C4A882', cellBg: '#FBF8F5', boxFg: '#3B2F2F', timeColBg: '#6B8F71',
      flame: '#D95030', zebra1: '#F9F5F0', zebra2: '#F0E8E0',
      timeZebra1: '#6B8F71', timeZebra2: '#587A5E',
      headRowBg: '#5A3E2B', headRowFg: '#F5F0EB', cornerBg: '#3B2F2F', cornerFg: '#E8D5BD',
      dashboardBg: '#F5F0EB', cardBg: '#FBF8F5', cardBorder: '#D9C4AB',
      textMain: '#3B2F2F', textMuted: '#6D5D4B', accentGold: '#8B5E3C', accentGreen: '#6B8F71',
      statusLive: '#4A9B6E', statusNext: '#8B5E3C', statusPrestart: '#D4903A',
    },
  },
  {
    // Dramatisches Dunkel-Theme — schwarze Saunasteine, glühende Aufguss-Glut,
    // warmes Birkenholz. Maximaler Sauna-Charakter für Premium-Displays.
    id: 'aufguss-ritual',
    name: 'Aufguss Ritual',
    colors: {
      // Basis: Vulkan-Schwarz mit warmem Rotunterton
      bg: '#0E0A08', fg: '#F0E4CC', accent: '#D4561A',
      // Gitter: dunkle Holzmaserung, tiefer Glutstreifen
      gridTable: '#321A0E', cellBg: '#1C1109', boxFg: '#F0E4CC', timeColBg: '#8A3018',
      // Flamme: reinste Feuerfarbe
      flame: '#FF3A18',
      // Zebra: kaum wahrnehmbar — Fokus auf Inhalte statt Zeilen
      zebra1: '#0E0A08', zebra2: '#160C08',
      timeZebra1: '#7A2C14', timeZebra2: '#5E2010',
      // Header (klassisch): dunkles Holz mit Crème-Text
      headRowBg: '#321A0E', headRowFg: '#F0E4CC',
      cornerBg: '#D4561A', cornerFg: '#FFF8F0',
      // Display (modern): tiefschwarz mit Holzpaneel-Karten
      dashboardBg: '#0B0807', cardBg: '#1C1109', cardBorder: '#321A0E',
      textMain: '#F0E4CC', textMuted: '#9A7258',
      accentGold: '#D4561A', accentGreen: '#8A6E58',
      // Status: lebendige Feuerfarben — LÄUFT brennt, GLEICH glüht, NÄCHSTER leuchtet
      statusLive: '#FF4422', statusNext: '#D4561A', statusPrestart: '#F0960A',
    },
  },
  {
    // Mineral Noir — kühles Schiefer-Schwarz, Platin-Akzente, architektonischer Minimalismus.
    // Kein Gradient, kein Glow — pure Struktur und Typografie.
    id: 'mineral-noir',
    name: 'Mineral Noir',
    colors: {
      // Basis: tiefes Schiefer mit kühlem Blauunterton
      bg: '#0D0F14', fg: '#ECEAE6', accent: '#B8B4AB',
      // Gitter: dunkler Stein, kaum vom Hintergrund unterscheidbar
      gridTable: '#22262E', cellBg: '#141820', boxFg: '#ECEAE6', timeColBg: '#1A1D24',
      // Flamme: kühles Smaragd statt Orange — eleganter Kontrast
      flame: '#3DD9AC',
      // Zebra: minimal — nur ein Hauch Tiefe
      zebra1: '#141820', zebra2: '#0D0F14',
      timeZebra1: '#1E2229', timeZebra2: '#1A1D24',
      // Header: fast schwarz mit Platin-Text
      headRowBg: '#0A0C10', headRowFg: '#B8B4AB',
      cornerBg: '#1A1D24', cornerFg: '#B8B4AB',
      // Display: dunkle Oberflächen, Steinbordüren
      dashboardBg: '#0D0F14', cardBg: '#141820', cardBorder: '#22262E',
      textMain: '#ECEAE6', textMuted: '#6B7280',
      accentGold: '#A09880',   // warmes Platin
      accentGreen: '#3DD9AC',  // kühles Smaragd
      // Status: Smaragd für aktiv, warmes Platin für nächste, kühles Blau für bald
      statusLive: '#3DD9AC', statusNext: '#A09880', statusPrestart: '#7B9BB8',
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getColorPalette(id: ColorPaletteName): Partial<ThemeColors> {
  const palette = COLOR_PALETTES.find((p) => p.id === id);
  return palette?.colors || COLOR_PALETTES[0].colors;
}

export function generateDashboardColors(baseColors: Partial<ThemeColors>): ThemeColors {
  const colors = { ...baseColors } as ThemeColors;
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

// ─── Default Settings Factory ─────────────────────────────────────────────────

export function getDefaultSettings(): Settings {
  const paletteId: ColorPaletteName = 'wellness-warm';
  const paletteColors = getColorPalette(paletteId);
  return {
    version: 1,
    displayAppearance: 'wellness-stage',
    designStyle: 'modern-wellness',
    colorPalette: paletteId,
    theme: generateDashboardColors(paletteColors) as ThemeColors,
    fonts: {
      fontScale: 1, h1Scale: 1.5, h2Scale: 1.2,
      overviewTitleScale: 1, overviewHeadScale: 1, overviewCellScale: 1,
      overviewTimeScale: 1, overviewTimeWidthScale: 1,
      tileTextScale: 1, tileTimeScale: 1, tileTimeWeight: 600,
      metaTextScale: 1, metaHeadScale: 1, badgeTextScale: 0.85, flameScale: 1,
    },
    slides: { defaultDuration: 10, transitionDuration: 1, showClock: true, clockPosition: 'top-right' },
    display: {
      gridColumns: 3,
      gridGap: 16,
      showBadges: true,
      showSubtitles: true,
      compactMode: false,
      prestartMinutes: 10,
    },
    audio: { enabled: false, volume: 0.5, loop: true },
    header: {
      enabled: true, showLogo: true, logoText: 'Westfalenbad Hagen',
      showClock: true, showDate: true, subtitle: 'Saunawelt', height: 8,
    },
    maintenanceScreen: { ...DEFAULT_MAINTENANCE_SCREEN_SETTINGS },
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
