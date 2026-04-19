import type { SlideViewport } from '@htmlsignage/design-sdk';

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
 * Editorial small-caps label — wide tracking, uppercase, serif-friendly.
 */
export function kickerStyles(
  color: string,
  sizePx: number,
): React.CSSProperties {
  return {
    color,
    fontSize: `${sizePx}px`,
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    fontWeight: 600,
    lineHeight: 1.2,
  };
}

/** Italic editorial eyebrow (e.g. "aus der Saunawelt"). */
export function eyebrowStyles(
  color: string,
  sizePx: number,
  fontFamily: string,
): React.CSSProperties {
  return {
    color,
    fontFamily,
    fontSize: `${sizePx}px`,
    fontStyle: 'italic',
    fontWeight: 400,
    letterSpacing: '0.02em',
    lineHeight: 1.2,
  };
}
