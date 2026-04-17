import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Default token set for Editorial Resort.
 *
 * Magazine-style palette: creamy warm paper, deep espresso text, a
 * restrained nutty-gold accent. Aims for the editorial "resort guide"
 * feel of the legacy editorial appearance without replicating its
 * radial-gradient chrome.
 */
export const editorialResortTokens: DesignTokens = {
  colors: {
    surface: '#F4EBD9',
    surfaceElevated: '#FBF6EB',
    border: '#D9C7A2',
    textPrimary: '#2F1F10',
    textSecondary: '#6B5233',
    textInverse: '#FBF6EB',
    accentPrimary: '#8A6E3A',
    accentSecondary: '#B49065',
    statusLive: '#1F8A5B',
    statusNext: '#C88A3A',
    statusWarning: '#D89B3C',
  },
  typography: {
    fontBody:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontHeading:
      '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontMono:
      '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    baseSizePx: 16,
    baseLineHeight: 1.55,
    scaleSm: 0.875,
    scaleBase: 1,
    scaleLg: 1.125,
    scaleXl: 1.3,
    scale2xl: 1.6,
    scale3xl: 2.2,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 28, xl: 48 },
  radius: { sm: 6, md: 16, lg: 28, pill: 9999 },
  motion: {
    durationFast: 180,
    durationBase: 300,
    durationSlow: 480,
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },
};
