import type { SlideViewport } from '../contract';

/**
 * Coarse viewport-bucket scale — slides shown in much smaller zones
 * shrink proportionally without flipping layouts. The four buckets
 * (full / short-or-narrow / compact / ultra-compact) match the host
 * runtime's responsive bands.
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
 * Compact font-size helper. `basePx` is the size at full viewport;
 * `min` is the floor used in ultra-compact zones.
 */
export function scaledFont(basePx: number, viewport: SlideViewport, min = 10): number {
  return Math.max(min, Math.round(basePx * responsiveScale(viewport)));
}
