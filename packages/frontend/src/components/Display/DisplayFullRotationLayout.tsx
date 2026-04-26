import { SlideRenderer } from '@/components/Display/SlideRenderer';
import { SlideTransition } from '@/components/Display/SlideTransition';
import type { DisplayLayoutContext } from '@/components/Display/displayLayoutRenderer.types';
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
