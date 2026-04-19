import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Editorial Resort — warm cream-paper tokens with serif editorial feel.
 *
 * Palette: a cream/paper surface, deep warm-ink primary text, and a
 * tobacco-sienna accent that reads as "luxury hotel brochure" rather
 * than "UI chrome". A botanical sage secondary grounds it.
 *
 * Typography leans on a serif heading family (Playfair-ish via
 * common system serifs) paired with a neutral sans for body. Mono is
 * still JetBrains for tabular-clean numerals — even a magazine layout
 * benefits from mono times when you have a packed schedule.
 *
 * Radii are modest — paper-cut feel, not pillow-UI. Motion is slower
 * than the wellness pack: deliberate, resort-paced transitions.
 */
export const editorialResortTokens: DesignTokens = {
  colors: {
    surface: '#F2EADE',
    surfaceElevated: '#FAF4E8',
    border: '#C8BFA8',
    textPrimary: '#2B2822',
    textSecondary: '#6B5E4B',
    textInverse: '#FAF4E8',
    accentPrimary: '#8B5A2B',
    accentSecondary: '#5A6B4D',
    statusLive: '#3D6B3B',
    statusNext: '#7A6547',
    statusWarning: '#C17817',
  },
  typography: {
    fontBody:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontHeading:
      '"Playfair Display", "Cormorant Garamond", "Noto Serif Display", Georgia, Cambria, "Times New Roman", Times, serif',
    fontMono:
      '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
    baseSizePx: 16,
    baseLineHeight: 1.55,
    scaleSm: 0.8125,
    scaleBase: 1,
    scaleLg: 1.1875,
    scaleXl: 1.5,
    scale2xl: 1.875,
    scale3xl: 2.625,
  },
  spacing: { xs: 4, sm: 10, md: 20, lg: 32, xl: 56 },
  radius: { sm: 2, md: 4, lg: 8, pill: 9999 },
  motion: {
    durationFast: 220,
    durationBase: 400,
    durationSlow: 700,
    easingStandard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    easingEmphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
};
