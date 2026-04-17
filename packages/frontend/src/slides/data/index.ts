/**
 * Headless slide-data hooks.
 *
 * Each hook consumes the existing domain models (Settings, Schedule,
 * Media, …) and returns a normalized `SlideDataFor<T>` object defined
 * by `@htmlsignage/design-sdk`. Slide renderers — legacy components
 * today, design-pack renderers from Phase 2 onwards — consume the
 * output without reaching back into the domain layer.
 */
export { useSaunaDetailData, type UseSaunaDetailDataInput } from './useSaunaDetailData';
export { useInfoPanelData, type UseInfoPanelDataInput } from './useInfoPanelData';
export { useEventsPanelData, type UseEventsPanelDataInput } from './useEventsPanelData';
export {
  useMediaImageData,
  useMediaVideoData,
  type UseMediaImageDataInput,
  type UseMediaVideoDataInput,
} from './useMediaSlideData';
export {
  useSchedulePanelData,
  type UseSchedulePanelDataInput,
  type SchedulePanelCellExtras,
  type SchedulePanelDataEnriched,
} from './useSchedulePanelData';
