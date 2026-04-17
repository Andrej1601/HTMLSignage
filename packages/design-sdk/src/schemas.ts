import { z } from 'zod';
import type {
  ColorTokens,
  DesignTokens,
  MotionTokens,
  RadiusTokens,
  SpacingTokens,
  TypographyTokens,
} from './tokens';
import type { DesignCapability, DesignManifest, DesignStatus } from './contract';
import type { SlideTypeId } from './slide-data';

// ─── Primitive validators ────────────────────────────────────────────────────

const semverRe = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const kebabRe = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Lenient CSS color validator. Accepts hex, rgb[a], hsl[a], oklch, named
 * keywords, and CSS variables. Intentionally permissive — designs need
 * flexibility, and the renderer will fail visibly if a value is invalid.
 */
const cssColor = z
  .string()
  .min(1)
  .refine(
    (v) =>
      /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ||
      /^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i.test(v) ||
      /^var\(--/.test(v) ||
      /^[a-zA-Z]+$/.test(v),
    { message: 'Expected a CSS color (hex, rgb[a], hsl[a], oklch, var(), or keyword).' },
  );

// ─── Token schemas ───────────────────────────────────────────────────────────

export const colorTokensSchema = z.object({
  surface: cssColor,
  surfaceElevated: cssColor,
  border: cssColor,
  textPrimary: cssColor,
  textSecondary: cssColor,
  textInverse: cssColor,
  accentPrimary: cssColor,
  accentSecondary: cssColor,
  statusLive: cssColor,
  statusNext: cssColor,
  statusWarning: cssColor,
}) satisfies z.ZodType<ColorTokens>;

export const typographyTokensSchema = z.object({
  fontBody: z.string().min(1),
  fontHeading: z.string().min(1),
  fontMono: z.string().min(1),
  baseSizePx: z.number().positive().max(200),
  baseLineHeight: z.number().positive().max(3),
  scaleSm: z.number().positive(),
  scaleBase: z.number().positive(),
  scaleLg: z.number().positive(),
  scaleXl: z.number().positive(),
  scale2xl: z.number().positive(),
  scale3xl: z.number().positive(),
}) satisfies z.ZodType<TypographyTokens>;

export const spacingTokensSchema = z.object({
  xs: z.number().nonnegative(),
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative(),
  xl: z.number().nonnegative(),
}) satisfies z.ZodType<SpacingTokens>;

export const radiusTokensSchema = z.object({
  sm: z.number().nonnegative(),
  md: z.number().nonnegative(),
  lg: z.number().nonnegative(),
  pill: z.number().nonnegative(),
}) satisfies z.ZodType<RadiusTokens>;

export const motionTokensSchema = z.object({
  durationFast: z.number().nonnegative(),
  durationBase: z.number().nonnegative(),
  durationSlow: z.number().nonnegative(),
  easingStandard: z.string().min(1),
  easingEmphasized: z.string().min(1),
}) satisfies z.ZodType<MotionTokens>;

export const designTokensSchema = z.object({
  colors: colorTokensSchema,
  typography: typographyTokensSchema,
  spacing: spacingTokensSchema,
  radius: radiusTokensSchema,
  motion: motionTokensSchema,
}) satisfies z.ZodType<DesignTokens>;

/** Partial override variant — same shape, every field optional. */
export const designTokenOverridesSchema = z.object({
  colors: colorTokensSchema.partial().optional(),
  typography: typographyTokensSchema.partial().optional(),
  spacing: spacingTokensSchema.partial().optional(),
  radius: radiusTokensSchema.partial().optional(),
  motion: motionTokensSchema.partial().optional(),
});

// ─── Manifest schema ─────────────────────────────────────────────────────────

const slideTypeIdSchema: z.ZodType<SlideTypeId> = z.enum([
  'sauna-detail',
  'content-panel',
  'infos',
  'events',
  'media-image',
  'media-video',
]);

const capabilitySchema: z.ZodType<DesignCapability> = z.enum([
  'dark-mode',
  'light-mode',
  'high-contrast',
  'portrait',
  'landscape',
  'reduced-motion',
  'custom-fonts',
]);

const statusSchema: z.ZodType<DesignStatus> = z.enum(['beta', 'stable', 'deprecated']);

export const designManifestSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(kebabRe, { message: 'id must be kebab-case (e.g. "wellness-classic").' }),
  version: z.string().regex(semverRe, { message: 'version must be semver (e.g. "1.0.0").' }),
  apiVersion: z
    .string()
    .regex(semverRe, { message: 'apiVersion must be semver (e.g. "1.0.0").' }),

  name: z.string().min(1).max(80),
  description: z.string().min(1).max(300),
  author: z.string().min(1).max(120).optional(),
  thumbnailUrl: z.string().min(1).optional(),

  supportedSlides: z.array(slideTypeIdSchema).min(1),
  capabilities: z.array(capabilitySchema),
  status: statusSchema,

  defaultTokens: designTokensSchema,

  appVersionRange: z.string().min(1).optional(),
}) satisfies z.ZodType<DesignManifest>;

/**
 * Validate a manifest. Returns the parsed value on success, or throws a
 * `ZodError` with structured issues. Call-sites should catch and format.
 */
export function parseDesignManifest(raw: unknown): DesignManifest {
  return designManifestSchema.parse(raw);
}

/**
 * Non-throwing variant — returns a `SafeParseResult`.
 */
export function safeParseDesignManifest(raw: unknown) {
  return designManifestSchema.safeParse(raw);
}
