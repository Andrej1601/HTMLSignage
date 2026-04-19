import type { ReactElement } from 'react';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import {
  MineralNoirPanel,
  MineralNoirStage,
  getMineralNoirStageMeta,
} from '@/components/Display/displayMineralNoirChrome';
import { DisplayFullRotationLayout } from '@/components/Display/DisplayFullRotationLayout';
import { DisplayGridLayout } from '@/components/Display/DisplayGridLayout';
import { DisplayHeader } from '@/components/Display/DisplayHeader';
import { DisplaySplitLayout } from '@/components/Display/DisplaySplitLayout';
import { DisplayTripleLayout } from '@/components/Display/DisplayTripleLayout';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { isEditorialDisplayAppearance, isMineralNoirDisplayAppearance } from '@/config/displayDesignStyles';
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
    if (slide && isMediaSlide(slide) && (
      isEditorialDisplayAppearance(displayAppearance) ||
      isMineralNoirDisplayAppearance(displayAppearance)
    )) {
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

  const renderInner = (): ReactElement => {
    if (!hasAnyZoneSlides) {
      if (isEditorialDisplayAppearance(displayAppearance)) {
        const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime, mediaItems);

        return (
          <DisplayEditorialStage
            theme={themeColors}
            subtitle={stageMeta.subtitle}
            title={stageMeta.title}
            meta={stageMeta.meta}
            logoImageUrl={stageMeta.logoImageUrl}
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

      if (isMineralNoirDisplayAppearance(displayAppearance)) {
        const stageMeta = getMineralNoirStageMeta(effectiveSettings, currentTime, mediaItems);

        return (
          <MineralNoirStage
            theme={themeColors}
            subtitle={stageMeta.subtitle}
            title={stageMeta.title}
            meta={stageMeta.meta}
            logoImageUrl={stageMeta.logoImageUrl}
          >
            <MineralNoirPanel
              theme={themeColors}
              accentTone="emerald"
            >
              {renderContentPanel()}
            </MineralNoirPanel>
          </MineralNoirStage>
        );
      }

      // The design pack handles every `designStyle` through
      // `renderContentPanel()`. The old `OverviewSlide` fallback (for
      // unrecognised styles) has been retired — the pack + host settings
      // together guarantee a valid style always resolves.
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

  // Editorial Resort and Mineral Noir ship their own stage-chrome with
  // branding (title/subtitle/meta). For those appearances the header
  // settings are consumed via `getEditorialStageMeta` /
  // `getMineralNoirStageMeta`, so we render the inner directly.
  //
  // For the default "wellness-stage" appearance there is no built-in
  // chrome — so we wrap the output with `DisplayHeader` when the header
  // is enabled. `DisplayHeader` itself early-returns when `enabled` is
  // false, so the check below is an optimisation, not a correctness gate.
  if (
    isEditorialDisplayAppearance(displayAppearance) ||
    isMineralNoirDisplayAppearance(displayAppearance)
  ) {
    return inner;
  }

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
