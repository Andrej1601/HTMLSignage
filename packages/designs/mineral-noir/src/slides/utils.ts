// Pure utilities (withAlpha, viewport scaling) live in the SDK so all four
// design packs share one canonical implementation. Only mineral-noir-
// specific text styles stay in this file.
export {
  withAlpha,
  responsiveScale,
  scaled,
  scaledFont,
} from '@htmlsignage/design-sdk';

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
