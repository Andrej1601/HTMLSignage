import type { SlideViewport } from '@htmlsignage/design-sdk';

/**
 * Shared responsive helpers for wellness-classic renderers. Keeps
 * compact/ultra-compact behaviour consistent across slide types.
 */
export function responsiveScale(viewport: SlideViewport): number {
  if (viewport.isUltraCompact) return 0.55;
  if (viewport.isCompact) return 0.7;
  if (viewport.isShort || viewport.isNarrow) return 0.85;
  return 1;
}

/** Multiply a pixel value by the responsive scale, clamped to a floor. */
export function scaled(valuePx: number, viewport: SlideViewport, floor = 2): number {
  return Math.max(floor, Math.round(valuePx * responsiveScale(viewport)));
}

/**
 * Return a compact font-size in px based on the viewport. `basePx` is
 * the value at full size; `min` is the floor for ultra-compact zones.
 */
export function scaledFont(basePx: number, viewport: SlideViewport, min = 10): number {
  return Math.max(min, Math.round(basePx * responsiveScale(viewport)));
}
