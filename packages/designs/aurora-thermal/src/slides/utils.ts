import type { CSSProperties } from 'react';
import type { ColorTokens, SlideViewport } from '@htmlsignage/design-sdk';

/**
 * Convert a hex color to an rgba() string with the given alpha.
 * Passes through non-hex values unchanged (rgb/hsl/oklch work as-is).
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

/** Viewport-derived scale factor. Smaller zones → smaller numbers. */
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
 * Aurora's ambient corner-glow — the signature atmospheric backdrop.
 *
 * Three superposed radial gradients (two warm, one cool) + a barely-
 * visible vertical sheen suggest off-screen candle / oven light
 * sources. Returned as a CSS `background` value so consumers can
 * combine it with a base colour on the same element.
 */
export function auroraAmbientBackground(colors: ColorTokens): string {
  return [
    // Top-left: warm brass glow (strongest)
    `radial-gradient(ellipse 75% 55% at 8% -8%, ${withAlpha(colors.accentPrimary, 0.22)} 0%, transparent 60%)`,
    // Top-right: embered live-tone glow
    `radial-gradient(ellipse 65% 50% at 108% -12%, ${withAlpha(colors.statusLive, 0.18)} 0%, transparent 55%)`,
    // Bottom-right: sage counterpoint, barely there
    `radial-gradient(ellipse 60% 55% at 95% 112%, ${withAlpha(colors.accentSecondary, 0.14)} 0%, transparent 60%)`,
    // Base: the dark stage
    `linear-gradient(180deg, ${colors.surface} 0%, ${colors.surface} 100%)`,
  ].join(', ');
}

/**
 * Aurora's small-caps label — brass-coloured, wide-tracked, uppercase.
 * The pack's editorial "kicker" / "eyebrow" voice.
 */
export function kickerStyles(color: string, sizePx: number): CSSProperties {
  return {
    color,
    fontSize: `${sizePx}px`,
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    fontWeight: 600,
    lineHeight: 1.2,
  };
}

/**
 * Italic editorial sub-label, used below titles and as quiet metadata.
 */
export function eyebrowStyles(
  color: string,
  sizePx: number,
  fontFamily: string,
): CSSProperties {
  return {
    color,
    fontFamily,
    fontSize: `${sizePx}px`,
    fontStyle: 'italic',
    fontWeight: 400,
    letterSpacing: '0.015em',
    lineHeight: 1.3,
  };
}

/**
 * Brass hairline — used in place of borders wherever two sections meet.
 * A 1-px horizontal rule with a brass gradient that fades at the edges,
 * so the eye registers division without the line ever looking heavy.
 */
export function brassHairline(colors: ColorTokens, widthPx = 1): CSSProperties {
  return {
    height: widthPx,
    background: `linear-gradient(90deg, transparent 0%, ${withAlpha(colors.accentPrimary, 0.65)} 20%, ${withAlpha(colors.accentPrimary, 0.85)} 50%, ${withAlpha(colors.accentPrimary, 0.65)} 80%, transparent 100%)`,
  };
}

/**
 * The brass status chip. Small, low-profile, with a subtle inner glow
 * when `isLive` so it doesn't look inert at a distance.
 */
export function statusChipStyles(
  color: string,
  options: { isLive?: boolean; sizePx: number; fontFamily: string } = {
    sizePx: 11,
    fontFamily: 'inherit',
  },
): CSSProperties {
  const { isLive, sizePx, fontFamily } = options;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${Math.round(sizePx * 0.55)}px`,
    padding: `${Math.round(sizePx * 0.35)}px ${Math.round(sizePx * 0.9)}px`,
    borderRadius: 9999,
    border: `1px solid ${withAlpha(color, 0.55)}`,
    backgroundColor: withAlpha(color, isLive ? 0.18 : 0.1),
    color,
    fontSize: `${sizePx}px`,
    fontFamily,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    lineHeight: 1,
    boxShadow: isLive
      ? `0 0 0 2px ${withAlpha(color, 0.08)}, 0 0 14px ${withAlpha(color, 0.35)}`
      : 'none',
    whiteSpace: 'nowrap',
  };
}

/**
 * Roman-numeral intensity mark in a brass ring. Quieter than a column
 * of flame emoji; reads unambiguously from across the room.
 */
export function romanNumeral(n: number): string {
  switch (n) {
    case 1: return 'I';
    case 2: return 'II';
    case 3: return 'III';
    case 4: return 'IV';
    default: return '';
  }
}
