import type { ReactElement } from 'react';
import { DisplayContentPanel } from '@/components/Display/DisplayContentPanel';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import { DisplayFullRotationLayout } from '@/components/Display/DisplayFullRotationLayout';
import { DisplayGridLayout } from '@/components/Display/DisplayGridLayout';
import { DisplaySplitLayout } from '@/components/Display/DisplaySplitLayout';
import { DisplayTripleLayout } from '@/components/Display/DisplayTripleLayout';
import { OverviewSlide } from '@/components/Display/OverviewSlide';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
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

export function DisplayLayoutRenderer({
  currentSlide,
  currentSlideIndex,
  currentTime,
  displayAppearance,
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
    return (
      <DisplayContentPanel
        schedule={localSchedule}
        settings={effectiveSettings}
        now={currentTime}
        deviceId={displayDeviceId}
      />
    );
  };

  const renderSlideWithPadding = (
    slide: SlideConfig | null | undefined,
    rendered: ReactElement,
    options?: SlidePaddingOptions,
  ): ReactElement => {
    if (slide && isMediaSlide(slide) && isEditorialDisplayAppearance(displayAppearance)) {
      return rendered;
    }

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
    displayAppearance,
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

  if (!hasAnyZoneSlides) {
    if (isEditorialDisplayAppearance(displayAppearance)) {
      const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime);

      return (
        <DisplayEditorialStage
          theme={themeColors}
          subtitle={stageMeta.subtitle}
          title={stageMeta.title}
          meta={stageMeta.meta}
        >
          <DisplayEditorialPanel
            theme={themeColors}
            tone="paper"
          >
            {renderContentPanel()}
          </DisplayEditorialPanel>
        </DisplayEditorialStage>
      );
    }

    return isModernDesign ? (
      renderContentPanel()
    ) : (
      <OverviewSlide
        schedule={localSchedule}
        settings={effectiveSettings}
        now={currentTime}
        deviceId={displayDeviceId}
      />
    );
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
}
