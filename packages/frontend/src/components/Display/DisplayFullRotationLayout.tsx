import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { SlideTransition } from '@/components/Display/SlideTransition';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
import {
  DisplayEditorialPanel,
  DisplayEditorialStage,
  getEditorialStageMeta,
} from '@/components/Display/displayEditorialChrome';
import { isEditorialDisplayAppearance } from '@/config/displayDesignStyles';
import type { SlideConfig } from '@/types/slideshow.types';

interface DisplayFullRotationLayoutProps {
  context: DisplayLayoutContext;
  currentSlide: SlideConfig | null;
  currentSlideIndex: number;
}

export function DisplayFullRotationLayout({
  context,
  currentSlide,
  currentSlideIndex,
}: DisplayFullRotationLayoutProps) {
  const {
    currentTime,
    displayDeviceId,
    effectiveSettings,
    enableTransitions,
    getZoneInfo,
    getZoneSlide,
    localSchedule,
    mediaItems,
    onVideoEnded,
    renderSlideWithPadding,
    resolveTransition,
    zones,
  } = context;

  const zoneWithSlides = zones.find((zone) => (getZoneInfo(zone.id)?.totalSlides ?? 0) > 0);
  const zoneId = zoneWithSlides?.id || zones[0]?.id || 'main';
  const slide = getZoneSlide(zoneId) || currentSlide;
  const zoneInfo = getZoneInfo(zoneId);
  const shouldRotate = (zoneInfo?.totalSlides ?? 0) > 1;
  const progressColor = context.themeColors.accentGold || context.themeColors.accent || '#A68A64';

  if (!slide) return null;

  const rendered = (
    <SlideRenderer
      schedule={localSchedule}
      settings={effectiveSettings}
      media={mediaItems}
      now={currentTime}
      deviceId={displayDeviceId}
      slide={slide}
      onVideoEnded={() => onVideoEnded(zoneId)}
    />
  );

  if (isEditorialDisplayAppearance(context.displayAppearance)) {
    const stageMeta = getEditorialStageMeta(effectiveSettings, currentTime);

    return (
      <DisplayEditorialStage
        theme={context.themeColors}
        subtitle={stageMeta.subtitle}
        title={stageMeta.title}
        meta={stageMeta.meta}
        contentClassName="h-[calc(100%-4.25rem)]"
      >
        <DisplayEditorialPanel
          theme={context.themeColors}
          tone="paper"
        >
          <SlideTransition
            slideKey={slide.id || currentSlideIndex}
            enabled={enableTransitions}
            duration={0.6}
            transition={resolveTransition(slide)}
            progressDurationSec={shouldRotate ? (slide.duration ?? 12) : undefined}
            progressColor={progressColor}
          >
            {renderSlideWithPadding(slide, rendered)}
          </SlideTransition>
        </DisplayEditorialPanel>
      </DisplayEditorialStage>
    );
  }

  return (
    <SlideTransition
      slideKey={slide.id || currentSlideIndex}
      enabled={enableTransitions}
      duration={0.6}
      transition={resolveTransition(slide)}
      progressDurationSec={shouldRotate ? (slide.duration ?? 12) : undefined}
      progressColor={progressColor}
    >
      {renderSlideWithPadding(slide, rendered)}
    </SlideTransition>
  );
}
