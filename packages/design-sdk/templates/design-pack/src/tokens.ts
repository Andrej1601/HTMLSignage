import type { DesignTokens } from '@htmlsignage/design-sdk';

/**
 * Default token set for {{designName}}.
 *
 * Tune the colours, typography and spacing here. Tenant/slideshow/device
 * overrides are applied on top by the host at render time — you only
 * need to set the pack's defaults.
 */
export const {{designIdCamel}}Tokens: DesignTokens = {
  colors: {
    surface: '#FFFFFF',
    surfaceElevated: '#F5F5F5',
    border: '#E5E5E5',
    textPrimary: '#111111',
    textSecondary: '#555555',
    textInverse: '#FFFFFF',
    accentPrimary: '#3B82F6',
    accentSecondary: '#93C5FD',
    statusLive: '#10B981',
    statusNext: '#3B82F6',
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
