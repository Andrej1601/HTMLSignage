import type { ReactElement } from 'react';
import { DisplayFullRotationLayout } from '@/components/Display/DisplayFullRotationLayout';
import { DisplayGridLayout } from '@/components/Display/DisplayGridLayout';
import { DisplayHeader } from '@/components/Display/DisplayHeader';
import { DisplaySplitLayout } from '@/components/Display/DisplaySplitLayout';
import { DisplayTripleLayout } from '@/components/Display/DisplayTripleLayout';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import {
  isMediaSlide,
  needsModernSlidePadding,
} from '@/components/Display/displayLayoutUtils';
import type {
  DisplayLayoutContext,
  DisplayLayoutRendererProps,
  SlidePaddingOptions,
} from '@/components/Display/displayLayoutRenderer.types';
import type { SlideConfig, Zone } from '@/types/slideshow.types';
import { getDefaultSettings } from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';

export function DisplayLayoutRenderer({
  currentSlide,
  currentSlideIndex,
  currentTime,
  designStyle,
  displayDeviceId,
  effectiveSettings,
  enableTransitions,
  getZoneInfo,
  getZoneSlide,
  isModernDesign,
  localSchedule,
  mediaItems,
  onVideoEnded,
  resolveTransition,
  safeLayout,
  showZoneBorders,
  themeColors,
  zones,
}: DisplayLayoutRendererProps) {
  const hasAnyZoneSlides = zones.some((zone) => (getZoneInfo(zone.id)?.totalSlides ?? 0) > 0);

  const renderContentPanel = (): ReactElement => {
    // Route the large content panel through `SlideRenderer` so the active
    // design pack gets a chance to render it. The slide type is fixed as
    // 'content-panel'; the id is synthesised from the designStyle so the
    // React subtree resets when the host switches styles.
    const syntheticSlide: SlideConfig = {
      id: `content-panel-large-${designStyle}`,
      type: 'content-panel',
      enabled: true,
      duration: 0,
      order: 0,
      transition: 'none',
    };
    return (
      <SlideRenderer
        schedule={localSchedule}
        settings={effectiveSettings}
        media={mediaItems}
        now={currentTime}
        deviceId={displayDeviceId}
        slide={syntheticSlide}
      />
    );
  };

  const renderSlideWithPadding = (
    slide: SlideConfig | null | undefined,
    rendered: ReactElement,
    options?: SlidePaddingOptions,
  ): ReactElement => {
    if (!slide || !needsModernSlidePadding(isModernDesign, slide)) {
      return rendered;
    }

    if (isMediaSlide(slide)) {
      return (
        <div className={options?.outerClassName || 'p-8 w-full h-full'}>
          <div
            className={
              options?.innerClassName ||
              'w-full h-full rounded-[2rem] overflow-hidden border-4 border-white shadow-lg'
            }
          >
            {rendered}
          </div>
        </div>
      );
    }

    return <div className={options?.outerClassName || 'p-8 w-full h-full'}>{rendered}</div>;
  };

  const renderZoneSlide = (
    slide: SlideConfig | null,
    zone?: Zone,
  ): ReactElement => {
    if (!slide) {
      return (
        <div className="w-full h-full flex items-center justify-center text-spa-text-secondary">
          Keine Slides
        </div>
      );
    }

    const rendered = (
      <SlideRenderer
        schedule={localSchedule}
        settings={effectiveSettings}
        media={mediaItems}
        now={currentTime}
        deviceId={displayDeviceId}
        slide={slide}
        onVideoEnded={() => zone && onVideoEnded(zone.id)}
      />
    );

    return renderSlideWithPadding(slide, rendered);
  };

  const layoutContext: DisplayLayoutContext = {
    currentTime,
    designStyle,
    displayDeviceId,
    effectiveSettings,
    enableTransitions,
    getZoneInfo,
    getZoneSlide,
    isModernDesign,
    localSchedule,
    mediaItems,
    onVideoEnded,
    renderContentPanel,
    renderSlideWithPadding,
    renderZoneSlide,
    resolveTransition,
    showZoneBorders,
    themeColors,
    zones,
  };

  const renderInner = (): ReactElement => {
    if (!hasAnyZoneSlides) {
      // The active design pack handles every `designStyle` through
      // `renderContentPanel()`. No legacy chrome wrapping any more —
      // the pack draws its own stage.
      return renderContentPanel();
    }

    switch (safeLayout) {
      case 'full-rotation':
        return (
          <DisplayFullRotationLayout
            context={layoutContext}
            currentSlide={currentSlide}
            currentSlideIndex={currentSlideIndex}
          />
        );

      case 'triple-view':
        return <DisplayTripleLayout context={layoutContext} />;

      case 'grid-2x2':
        return <DisplayGridLayout context={layoutContext} />;

      case 'split-view':
      default:
        return <DisplaySplitLayout context={layoutContext} />;
    }
  };

  const inner = renderInner();

  // Header (logo + clock + date) is rendered above every layout when
  // enabled. Legacy pack-specific stage chromes (Editorial / Mineral
  // Noir) are gone; the active design pack renders its own in-slide
  // chrome where applicable.
  const headerSettings =
    effectiveSettings.header ?? getDefaultSettings().header!;

  if (!headerSettings.enabled) {
    return inner;
  }

  const logoImageUrl =
    getMediaUploadUrl(mediaItems, headerSettings.logoImageId) ?? undefined;

  return (
    <div className="flex h-full w-full flex-col">
      <DisplayHeader
        settings={headerSettings}
        theme={themeColors}
        logoImageUrl={logoImageUrl}
      />
      <div className="min-h-0 flex-1">{inner}</div>
    </div>
  );
}
