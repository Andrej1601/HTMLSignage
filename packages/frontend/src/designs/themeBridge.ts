import type { DesignTokenOverrides, DesignTokens } from '@htmlsignage/design-sdk';
import type { ThemeColors } from '@/types/settings.types';

type ColorOverrides = Partial<DesignTokens['colors']>;

/**
 * Translate the host's current `ThemeColors` into a partial override for
 * a design pack's color tokens.
 *
 * The pack ships opinionated defaults for its palette; tenants/operators
 * express brand preferences via the existing Theme/Palette editor, and
 * we simply re-route those values to the equivalent token names.
 * Only fields the theme actually carries are emitted — everything else
 * keeps the pack's default.
 */
export function themeToTokenOverrides(
  theme: ThemeColors | undefined | null,
): DesignTokenOverrides | undefined {
  if (!theme) return undefined;

  const colors: ColorOverrides = {};

  const surface = theme.dashboardBg || theme.bg;
  if (surface) colors.surface = surface;

  const elevated = theme.cardBg || theme.cellBg;
  if (elevated) colors.surfaceElevated = elevated;

  const border = theme.cardBorder || theme.gridTable;
  if (border) colors.border = border;

  const textPrimary = theme.textMain || theme.fg;
  if (textPrimary) colors.textPrimary = textPrimary;

  if (theme.textMuted) colors.textSecondary = theme.textMuted;

  const accentPrimary = theme.accentGold || theme.accent;
  if (accentPrimary) colors.accentPrimary = accentPrimary;

  if (theme.accentGreen) colors.accentSecondary = theme.accentGreen;

  if (theme.statusLive) colors.statusLive = theme.statusLive;
  if (theme.statusNext) colors.statusNext = theme.statusNext;
  if (theme.statusPrestart) colors.statusWarning = theme.statusPrestart;

  if (Object.keys(colors).length === 0) return undefined;
  return { colors };
}

/**
 * Compose a theme-derived override with an explicit per-slideshow
 * override (typically typed in by an operator via the admin UI). The
 * explicit override wins token-by-token so tenants can selectively
 * re-skin a pack without re-specifying every colour.
 *
 *   base = themeToTokenOverrides(theme)   // auto-mapped from palette
 *   top  = slideshow.tokenOverrides       // hand-curated brand tweaks
 *
 * → `top` takes precedence inside each section, missing fields fall
 * through to `base`, then to the pack's `defaultTokens`.
 */
export function mergeTokenOverrides(
  base: DesignTokenOverrides | undefined,
  top: DesignTokenOverrides | undefined,
): DesignTokenOverrides | undefined {
  if (!base && !top) return undefined;
  if (!base) return top;
  if (!top) return base;

  const out: DesignTokenOverrides = {};
  for (const key of ['colors', 'typography', 'spacing', 'radius', 'motion'] as const) {
    const merged = { ...(base[key] ?? {}), ...(top[key] ?? {}) };
    if (Object.keys(merged).length > 0) {
      (out as Record<string, unknown>)[key] = merged;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
