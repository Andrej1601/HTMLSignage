import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Mineral Noir — architectural dark-luxury tokens.
 *
 * Palette: deep slate surfaces, platinum/champagne accent, cool mint
 * for live-state so the structure reads against warm lamp photography.
 * Typography leans on heavy letter-spacing and monospaced numerals —
 * the visual language is "engineering drawing meets luxury hotel".
 * Radii are intentionally small (no rounded decoration) and borders
 * are hairline weight; the pack reads via structure, not colour fills.
 */
export const mineralNoirTokens: DesignTokens = {
  colors: {
    surface: '#0C0F14',
    surfaceElevated: '#141820',
    border: '#232A36',
    textPrimary: '#E6E2D6',
    textSecondary: '#8A8F99',
    textInverse: '#0C0F14',
    accentPrimary: '#C8BFA6',
    accentSecondary: '#6B7280',
    statusLive: '#7DD3C0',
    statusNext: '#9CA3AF',
    statusWarning: '#E8B86A',
  },
  typography: {
    fontBody:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontHeading:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontMono:
      '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, Monaco, Consolas, monospace',
    baseSizePx: 16,
    baseLineHeight: 1.5,
    scaleSm: 0.8125,
    scaleBase: 1,
    scaleLg: 1.1875,
    scaleXl: 1.4375,
    scale2xl: 1.75,
    scale3xl: 2.25,
  },
  spacing: { xs: 4, sm: 10, md: 16, lg: 28, xl: 48 },
  radius: { sm: 2, md: 4, lg: 6, pill: 9999 },
  motion: {
    durationFast: 200,
    durationBase: 360,
    durationSlow: 600,
    easingStandard: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easingEmphasized: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
};
