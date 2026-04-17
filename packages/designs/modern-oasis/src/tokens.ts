import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Default token set for Modern Oasis.
 *
 * A contemporary, purple-accented palette — distinctly different from
 * wellness-classic so that switching designs is visible at a glance.
 * Tenant/slideshow/device overrides are applied on top by the host at
 * render time.
 */
export const modernOasisTokens: DesignTokens = {
  colors: {
    surface: '#F6F1EA',
    surfaceElevated: '#FFFBF4',
    border: '#E3D7C4',
    textPrimary: '#2A1A33',
    textSecondary: '#6B5473',
    textInverse: '#FFFFFF',
    accentPrimary: '#8B1D7A',
    accentSecondary: '#C48BBE',
    statusLive: '#16A34A',
    statusNext: '#D97706',
    statusWarning: '#EAB308',
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
  radius: { sm: 6, md: 14, lg: 28, pill: 9999 },
  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },
};
