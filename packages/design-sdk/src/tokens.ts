/**
 * Canonical design tokens shared by all design packs.
 *
 * Designs provide default values for these tokens in their manifest.
 * Tenant/slideshow/device overrides merge on top. The renderer receives
 * the fully merged `DesignTokens` at render time — never raw CSS values
 * scattered across components.
 *
 * Kept intentionally small and abstract. Domain-specific colors (e.g.
 * sauna status, aroma badges) belong to slide-level data, not tokens.
 */

/** Semantic color tokens. Values are CSS color strings (hex, rgb, hsl, oklch…). */
export interface ColorTokens {
  /** Page/stage background. */
  surface: string;
  /** Elevated surface (cards, tiles). */
  surfaceElevated: string;
  /** Subtle borders and dividers. */
  border: string;

  /** Primary text on `surface` / `surfaceElevated`. */
  textPrimary: string;
  /** Secondary / muted text. */
  textSecondary: string;
  /** Text that appears on accent-colored backgrounds. */
  textInverse: string;

  /** Primary accent — CTAs, highlights, active states. */
  accentPrimary: string;
  /** Secondary accent — supporting highlights. */
  accentSecondary: string;

  /** "Live now" status (e.g. ongoing aufguss). */
  statusLive: string;
  /** "Up next" status. */
  statusNext: string;
  /** "Starting soon" / warning. */
  statusWarning: string;
}

/** Typography tokens. Font families, weights, and a base scale. */
export interface TypographyTokens {
  /** Font stack for body text. */
  fontBody: string;
  /** Font stack for headings. */
  fontHeading: string;
  /** Monospace font stack (times, numbers). */
  fontMono: string;

  /** Base font size in px. All `scale*` values multiply this. */
  baseSizePx: number;
  /** Base line-height multiplier. */
  baseLineHeight: number;

  /** Scale multipliers applied to `baseSizePx`. Designs may tune these. */
  scaleSm: number;
  scaleBase: number;
  scaleLg: number;
  scaleXl: number;
  scale2xl: number;
  scale3xl: number;
}

/** Spacing tokens in px. */
export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

/** Border-radius tokens in px. Use `pill` for fully rounded elements. */
export interface RadiusTokens {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

/** Motion tokens. Durations in ms, easings as CSS timing-function strings. */
export interface MotionTokens {
  durationFast: number;
  durationBase: number;
  durationSlow: number;
  easingStandard: string;
  easingEmphasized: string;
}

/** Complete token set received by every slide renderer. */
export interface DesignTokens {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  motion: MotionTokens;
}

/**
 * A partial override layer. Used by tenants, slideshows, and devices to
 * tweak a design's defaults without replacing the entire token set.
 */
export type DesignTokenOverrides = {
  [K in keyof DesignTokens]?: Partial<DesignTokens[K]>;
};
