import type { IntensityDisplay, SlideViewport } from '@htmlsignage/design-sdk';
import type { ReactNode } from 'react';

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

/**
 * Inline SVG flame — closed Lucide-shape path. Rendered four times at
 * different fill states to communicate aufguss intensity (1–4). The
 * filled-count matches the intensity level.
 */
export function FlameIcon({
  size,
  color,
  filled,
}: {
  size: number;
  color: string;
  filled: boolean;
}): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

/** Roman-numeral I–IV for the `roman` intensity-display style. */
export function romanNumeral(n: number): string {
  switch (n) {
    case 1: return 'I';
    case 2: return 'II';
    case 3: return 'III';
    case 4: return 'IV';
    default: return '';
  }
}

/**
 * Shared intensity mark. Picks flames vs. Roman numeral based on the
 * host-provided `intensityDisplay` hint. Both forms are legible at
 * display distance and respect the active / finished colour the
 * caller supplies.
 */
export function IntensityMark({
  level,
  color,
  idleColor,
  size,
  display,
  fontFamily,
}: {
  level: number;
  color: string;
  idleColor: string;
  size: number;
  display: IntensityDisplay;
  fontFamily: string;
}): ReactNode {
  if (display === 'roman') {
    return (
      <span
        className="shrink-0 inline-flex items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          color,
          fontFamily,
          fontSize: `${Math.round(size * 0.42)}px`,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
        aria-label={`Intensität ${level} von 4`}
      >
        {romanNumeral(level)}
      </span>
    );
  }
  // flames
  const gap = Math.max(1, Math.round(size * 0.14));
  const flameSize = Math.round(size * 0.85);
  return (
    <span
      className="shrink-0 inline-flex items-center"
      style={{ gap }}
      aria-label={`Intensität ${level} von 4`}
    >
      {[1, 2, 3, 4].map((i) => (
        <FlameIcon
          key={i}
          size={flameSize}
          color={i <= level ? color : idleColor}
          filled={i <= level}
        />
      ))}
    </span>
  );
}
