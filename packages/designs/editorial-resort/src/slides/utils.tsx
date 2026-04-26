// Pure utilities (withAlpha, viewport scaling, intensity mark) live in the SDK
// so all four design packs share one canonical implementation. Only the
// editorial-resort-specific text styles (kicker / eyebrow letter-spacing) and
// any pack-specific helpers belong in this file.
export {
  withAlpha,
  responsiveScale,
  scaled,
  scaledFont,
  romanNumeral,
  FlameIcon,
  IntensityMark,
} from '@htmlsignage/design-sdk';

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
