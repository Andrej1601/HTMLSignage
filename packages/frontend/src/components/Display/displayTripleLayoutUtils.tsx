import type { ReactElement } from 'react';
import { SlideRenderer } from '@/components/Display/SlideRenderer';
import type {
  DisplayLayoutContext,
  SlidePaddingOptions,
  TripleZoneState,
  TripleZoneStateMap,
} from '@/components/Display/displayLayoutRenderer.types';
import type { SlideConfig, Zone } from '@/types/slideshow.types';

function createTripleZoneState(
  context: DisplayLayoutContext,
  zone: Zone | undefined,
): TripleZoneState {
  if (!zone) {
    return {
      zone: undefined,
      slide: null,
      info: null,
    };
  }

  return {
    zone,
    slide: context.getZoneSlide(zone.id),
    info: context.getZoneInfo(zone.id),
  };
}

export function getTripleZoneStates(context: DisplayLayoutContext): TripleZoneStateMap {
  const tripleZones = context.zones.filter(
    (zone) => zone.id === 'left' || zone.id === 'top-right' || zone.id === 'bottom-right',
  );

  return {
    left: createTripleZoneState(
      context,
      tripleZones.find((zone) => zone.id === 'left'),
    ),
    topRight: createTripleZoneState(
      context,
      tripleZones.find((zone) => zone.id === 'top-right'),
    ),
    bottomRight: createTripleZoneState(
      context,
      tripleZones.find((zone) => zone.id === 'bottom-right'),
    ),
  };
}

export function renderTripleSlideRenderer(
  context: DisplayLayoutContext,
  slide: SlideConfig,
  zoneId?: string,
): ReactElement {
  const {
    currentTime,
    displayDeviceId,
    effectiveSettings,
    localSchedule,
    mediaItems,
    onVideoEnded,
  } = context;

  return (
    <SlideRenderer
      schedule={localSchedule}
      settings={effectiveSettings}
      media={mediaItems}
      now={currentTime}
      deviceId={displayDeviceId}
      slide={slide}
      onVideoEnded={() => zoneId && onVideoEnded(zoneId)}
    />
  );
}

export function renderTriplePaddedSlide(
  context: DisplayLayoutContext,
  slide: SlideConfig,
  zoneId?: string,
  options?: SlidePaddingOptions,
): ReactElement {
  return context.renderSlideWithPadding(
    slide,
    renderTripleSlideRenderer(context, slide, zoneId),
    options,
  );
}

export function renderTripleSaunaDetail(
  context: DisplayLayoutContext,
  saunaId?: string,
): ReactElement {
  // Synthesize a minimal SlideConfig so the unified SlideRenderer /
  // DesignHost pipeline resolves this slide through the active design
  // pack — no direct legacy component rendering.
  const slide: SlideConfig = {
    id: `triple-sauna-${saunaId ?? 'none'}`,
    type: 'sauna-detail',
    enabled: true,
    duration: 0,
    order: 0,
    saunaId,
  };
  return renderTripleSlideRenderer(context, slide);
}
