import type { CSSProperties, ReactNode } from 'react';
import type { ColorTokens, IntensityDisplay } from '@htmlsignage/design-sdk';
import {
  withAlpha,
  scaled,
  scaledFont,
  responsiveScale,
  IntensityMark as SharedIntensityMark,
  romanNumeral,
  FlameIcon,
} from '@htmlsignage/design-sdk';

// Re-export SDK primitives under the same names so call-sites inside this
// pack keep using `from './utils'` without churn.
export { withAlpha, scaled, scaledFont, responsiveScale, romanNumeral, FlameIcon };

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
 * Aurora-flavoured intensity mark. Wraps the shared SDK component with
 * the pack-specific tuning that gives the brass-on-dark look its bite:
 * slightly larger flames, tabular roman numerals on a faint chip.
 */
export function IntensityMark(props: {
  level: number;
  color: string;
  idleColor: string;
  size: number;
  display: IntensityDisplay;
  fontFamily: string;
}): ReactNode {
  return (
    <SharedIntensityMark
      {...props}
      flameRatio={0.88}
      romanFontRatio={0.4}
      romanBorderAlpha={0.65}
      romanBackground
      romanTabularNums
    />
  );
}
