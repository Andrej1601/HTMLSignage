import type { SlideViewport } from '@htmlsignage/design-sdk';

/**
 * Convert a `#rrggbb` / `#rgb` hex to `rgba(r,g,b,a)`. Non-hex colours
 * are returned unchanged (so CSS named colours and `rgb(...)` values
 * pass through safely).
 */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  if (!c.startsWith('#')) return c;
  const raw = c.slice(1);
  const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  if (hex.length !== 6) return c;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

/**
 * Coarse viewport-bucket scale — slides into much smaller zones
 * should shrink sizes proportionally without flipping layouts.
 */
export function responsiveScale(viewport: SlideViewport): number {
  if (viewport.isUltraCompact) return 0.55;
  if (viewport.isCompact) return 0.7;
  if (viewport.isShort || viewport.isNarrow) return 0.85;
  return 1;
}

export function scaled(px: number, viewport: SlideViewport, floor = 2): number {
  return Math.max(floor, Math.round(px * responsiveScale(viewport)));
}

export function scaledFont(basePx: number, viewport: SlideViewport, min = 10): number {
  return Math.max(min, Math.round(basePx * responsiveScale(viewport)));
}

/**
 * Return widely-spaced uppercase styles used for small-caps labels
 * throughout the pack. Centralised so the letter-spacing is uniform.
 */
export function labelStyles(
  color: string,
  sizePx: number,
): React.CSSProperties {
  return {
    color,
    fontSize: `${sizePx}px`,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    fontWeight: 600,
    lineHeight: 1.2,
  };
}
