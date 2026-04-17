import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Default token set for Wellness Classic.
 *
 * Colors are lifted 1:1 from the legacy `standard-warm` palette so
 * side-by-side rendering against the pre-rework display is visually
 * identical. Typography / spacing / motion establish a shared
 * contract that downstream designs can diverge from.
 */
export const wellnessClassicTokens: DesignTokens = {
  colors: {
    surface: '#E8DEBD',
    surfaceElevated: '#F9F7F4',
    border: '#D4A574',
    textPrimary: '#5C3101',
    textSecondary: '#7A4A1F',
    textInverse: '#FFFFFF',
    accentPrimary: '#D4A574',
    accentSecondary: '#B8976A',
    statusLive: '#10B981',
    statusNext: '#D4A574',
    statusWarning: '#F59E0B',
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
  radius: { sm: 4, md: 12, lg: 24, pill: 9999 },
  motion: {
    durationFast: 150,
    durationBase: 250,
    durationSlow: 400,
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1.2)',
  },
};
