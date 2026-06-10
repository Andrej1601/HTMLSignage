import type { ReactNode } from 'react';
import type { IntensityDisplay } from '../contract';
import { withAlpha } from './colors';

/** Roman-numeral helper for the `roman` intensity-display style. */
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
 * Inline SVG flame — closed Lucide-shape path. Rendered four times at
 * different fill states to communicate aufguss intensity (1-4).
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

/**
 * Shared intensity mark. Picks flames vs. roman numerals based on the
 * host-provided `display` hint. `flameRatio` controls flame size as a
 * fraction of the container size (defaults to 0.85 — designs can pass
 * 0.88 etc. to fine-tune their visual rhythm). `romanBackground` opts
 * the roman variant into a faint tinted background pill.
 */
export function IntensityMark({
  level,
  color,
  idleColor,
  size,
  display,
  fontFamily,
  flameRatio = 0.85,
  romanBorderAlpha = 1,
  romanFontRatio = 0.42,
  romanBackground = false,
  romanTabularNums = false,
}: {
  level: number;
  color: string;
  idleColor: string;
  size: number;
  display: IntensityDisplay;
  fontFamily: string;
  /** Flame size as a fraction of `size` (default 0.85). */
  flameRatio?: number;
  /** Alpha applied to the roman-variant border colour (default 1). */
  romanBorderAlpha?: number;
  /** Roman font-size as a fraction of `size` (default 0.42). */
  romanFontRatio?: number;
  /** When true, fill the roman variant with a faint tinted background. */
  romanBackground?: boolean;
  /** Add `tabular-nums` className to the roman variant (kerning-stable). */
  romanTabularNums?: boolean;
}): ReactNode {
  if (display === 'roman') {
    return (
      <span
        className={`shrink-0 inline-flex items-center justify-center${romanTabularNums ? ' tabular-nums' : ''}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1px solid ${romanBorderAlpha < 1 ? withAlpha(color, romanBorderAlpha) : color}`,
          color,
          fontFamily,
          fontSize: `${Math.round(size * romanFontRatio)}px`,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1,
          backgroundColor: romanBackground ? withAlpha(color, 0.08) : undefined,
        }}
        aria-label={`Intensität ${level} von 4`}
      >
        {romanNumeral(level)}
      </span>
    );
  }
  // flames
  const gap = Math.max(1, Math.round(size * 0.14));
  const flameSize = Math.round(size * flameRatio);
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
