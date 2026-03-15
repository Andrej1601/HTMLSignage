import type { LayoutType, SlideConfig } from '@/types/slideshow.types';

const SUPPORTED_LAYOUTS: LayoutType[] = ['split-view', 'full-rotation', 'triple-view', 'grid-2x2'];

export function normalizeDisplayLayout(layout: unknown): LayoutType {
  return SUPPORTED_LAYOUTS.includes(layout as LayoutType)
    ? (layout as LayoutType)
    : 'split-view';
}

export function isMediaSlide(slide: SlideConfig | null | undefined): boolean {
  return Boolean(slide && typeof slide.type === 'string' && slide.type.startsWith('media-'));
}

export function needsModernSlidePadding(
  isModernDesign: boolean,
  slide: SlideConfig | null | undefined,
): boolean {
  if (!isModernDesign || !slide) return false;
  return isMediaSlide(slide) || slide.type === 'infos' || slide.type === 'events';
}
