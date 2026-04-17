import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Default token set for Mineral Noir.
 *
 * Architectural dark-luxury palette: deep slate surface, platinum text,
 * an emerald status-live accent to offset the gold warmth of other
 * packs. Lifted from the legacy mineral-noir ColorPalette but flattened
 * to the SDK token contract — no "wood grain" or "zebra" nuances.
 */
export const mineralNoirTokens: DesignTokens = {
  colors: {
    surface: '#0D0F14',
    surfaceElevated: '#141820',
    border: '#22262E',
    textPrimary: '#ECEAE6',
    textSecondary: '#8A8F99',
    textInverse: '#0D0F14',
    accentPrimary: '#C9BC9C',
    accentSecondary: '#8A8F99',
    statusLive: '#3DD9AC',
    statusNext: '#C9BC9C',
    statusWarning: '#E0B869',
  },
  typography: {
    fontBody:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontHeading:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    baseSizePx: 16,
    baseLineHeight: 1.5,
    scaleSm: 0.875,
    scaleBase: 1,
    scaleLg: 1.125,
    scaleXl: 1.25,
    scale2xl: 1.5,
    scale3xl: 2,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 },
  radius: { sm: 2, md: 4, lg: 8, pill: 9999 },
  motion: {
    durationFast: 120,
    durationBase: 220,
    durationSlow: 380,
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },
};
