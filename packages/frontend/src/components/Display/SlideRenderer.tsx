import { memo, useMemo } from 'react';
import { type SlideConfig } from '@/types/slideshow.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import type { DesignTokenOverrides, SlideRenderContext } from '@htmlsignage/design-sdk';
import { SlideErrorBoundary } from './SlideErrorBoundary';
import {
  useEventsPanelData,
  useInfoPanelData,
  useMediaImageData,
  useMediaVideoData,
  useSaunaDetailData,
  useSchedulePanelData,
} from '@/slides/data';
import {
  DesignHost,
  DEFAULT_DESIGN_ID,
  isKnownDesignId,
  themeToTokenOverrides,
  type DesignId,
} from '@/designs';

interface SlideRendererProps {
  slide: SlideConfig;
  onVideoEnded?: () => void;
  schedule: Schedule;
  settings: Settings;
  media?: Media[];
  now?: Date;
  deviceId?: string;
}

/** Minimal fallback element rendered while a design pack is loading or
 * if the active pack doesn't ship a renderer for this slide type. */
function UnavailableSlide({ reason }: { reason: string }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center text-sm text-white/60 bg-black/60"
      aria-hidden="true"
    >
      {reason}
    </div>
  );
}

function SlideRendererComponent({
  slide,
  onVideoEnded,
  schedule,
  settings,
  media,
  now,
  deviceId,
}: SlideRendererProps) {
  const content = (() => {
    switch (slide.type) {
      case 'content-panel':
        return (
          <ContentPanelDispatch
            slide={slide}
            schedule={schedule}
            settings={settings}
            now={now}
            deviceId={deviceId}
          />
        );

      case 'sauna-detail':
        return (
          <SaunaDetailDispatch
            slide={slide}
            schedule={schedule}
            settings={settings}
            media={media}
            now={now}
            deviceId={deviceId}
          />
        );

      case 'media-image':
        return (
          <MediaImageDispatch slide={slide} settings={settings} media={media} deviceId={deviceId} />
        );

      case 'media-video':
        return (
          <MediaVideoDispatch
            slide={slide}
            settings={settings}
            media={media}
            deviceId={deviceId}
            onVideoEnded={onVideoEnded}
          />
        );

      case 'infos':
        return <InfosSlideDispatch slide={slide} settings={settings} media={media} deviceId={deviceId} />;

      case 'events':
        return <EventsSlideDispatch slide={slide} settings={settings} media={media} now={now} deviceId={deviceId} />;

      default:
        return <UnavailableSlide reason="Unbekannter Slide-Typ" />;
    }
  })();

  return (
    <SlideErrorBoundary slideKey={slide.id}>
      {content}
    </SlideErrorBoundary>
  );
}

function areSlideRendererPropsEqual(prev: SlideRendererProps, next: SlideRendererProps): boolean {
  return (
    prev.slide === next.slide &&
    prev.schedule === next.schedule &&
    prev.settings === next.settings &&
    prev.media === next.media &&
    prev.deviceId === next.deviceId &&
    (prev.now?.getTime() ?? -1) === (next.now?.getTime() ?? -1)
  );
}

export const SlideRenderer = memo(SlideRendererComponent, areSlideRendererPropsEqual);

// ── Dispatcher helpers ──────────────────────────────────────────────────────

/**
 * Merge token override layers in the canonical order:
 *   pack default  ←  theme-palette derivation  ←  explicit JSON overrides
 * Returns `undefined` when nothing would override the pack.
 */
function mergeOverrideLayers(
  base: DesignTokenOverrides | undefined,
  top: DesignTokenOverrides | undefined,
): DesignTokenOverrides | undefined {
  if (!base) return top;
  if (!top) return base;
  return {
    colors: { ...(base.colors ?? {}), ...(top.colors ?? {}) },
    typography: { ...(base.typography ?? {}), ...(top.typography ?? {}) },
    spacing: { ...(base.spacing ?? {}), ...(top.spacing ?? {}) },
    radius: { ...(base.radius ?? {}), ...(top.radius ?? {}) },
    motion: { ...(base.motion ?? {}), ...(top.motion ?? {}) },
  };
}

function resolveDesign(settings: Settings): {
  designId: DesignId;
  tokenOverrides: DesignTokenOverrides | undefined;
} {
  const configuredId = settings.display?.designPackId;
  const designId = isKnownDesignId(configuredId) ? configuredId : DEFAULT_DESIGN_ID;
  const fromTheme = themeToTokenOverrides(settings.theme);
  const explicit = settings.display?.designTokenOverrides;
  const tokenOverrides = mergeOverrideLayers(fromTheme, explicit);
  return { designId, tokenOverrides };
}

function buildRenderContext(
  slide: SlideConfig,
  deviceId: string | undefined,
  extra?: Partial<Omit<SlideRenderContext, 'viewport'>>,
): Omit<SlideRenderContext, 'viewport'> {
  return {
    zoneId: slide.zoneId ?? 'default',
    durationMs: (slide.duration ?? 5) * 1000,
    transitionsEnabled: true,
    locale: 'de-DE',
    deviceId,
    ...extra,
  };
}

// ── Per-slide dispatchers ───────────────────────────────────────────────────

function InfosSlideDispatch({
  slide,
  settings,
  media,
  deviceId,
}: {
  slide: SlideConfig;
  settings: Settings;
  media?: Media[];
  deviceId?: string;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const data = useInfoPanelData({ settings, infoId: slide.infoId, media });
  const context = buildRenderContext(slide, deviceId);
  return (
    <DesignHost
      slideType="infos"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Info nicht verfügbar" />}
    />
  );
}

function MediaImageDispatch({
  slide,
  settings,
  media,
  deviceId,
}: {
  slide: SlideConfig;
  settings: Settings;
  media?: Media[];
  deviceId?: string;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const data = useMediaImageData({ slide, media });
  const context = buildRenderContext(slide, deviceId);
  if (!data) return <UnavailableSlide reason="Bild nicht gefunden" />;
  return (
    <DesignHost
      slideType="media-image"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Bild konnte nicht geladen werden" />}
    />
  );
}

function MediaVideoDispatch({
  slide,
  settings,
  media,
  deviceId,
  onVideoEnded,
}: {
  slide: SlideConfig;
  settings: Settings;
  media?: Media[];
  deviceId?: string;
  onVideoEnded?: () => void;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const data = useMediaVideoData({ slide, media });
  const context = buildRenderContext(slide, deviceId, { onVideoEnded });
  if (!data) return <UnavailableSlide reason="Video nicht gefunden" />;
  return (
    <DesignHost
      slideType="media-video"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Video konnte nicht geladen werden" />}
    />
  );
}

function EventsSlideDispatch({
  slide,
  settings,
  media,
  now,
  deviceId,
}: {
  slide: SlideConfig;
  settings: Settings;
  media?: Media[];
  now?: Date;
  deviceId?: string;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const effectiveNow = useMemo(() => now ?? new Date(), [now]);
  const data = useEventsPanelData({ settings, media, now: effectiveNow });
  const context = buildRenderContext(slide, deviceId);
  return (
    <DesignHost
      slideType="events"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Events nicht verfügbar" />}
    />
  );
}

function SaunaDetailDispatch({
  slide,
  schedule,
  settings,
  media,
  now,
  deviceId,
}: {
  slide: SlideConfig;
  schedule: Schedule;
  settings: Settings;
  media?: Media[];
  now?: Date;
  deviceId?: string;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const effectiveNow = useMemo(() => now ?? new Date(), [now]);
  const data = useSaunaDetailData({
    settings,
    schedule,
    saunaId: slide.saunaId,
    media,
    deviceId,
    now: effectiveNow,
  });
  const context = buildRenderContext(slide, deviceId);
  if (!data) return <UnavailableSlide reason="Sauna nicht gefunden" />;
  return (
    <DesignHost
      slideType="sauna-detail"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Sauna-Detail nicht verfügbar" />}
    />
  );
}

function ContentPanelDispatch({
  slide,
  schedule,
  settings,
  now,
  deviceId,
}: {
  slide: SlideConfig;
  schedule: Schedule;
  settings: Settings;
  now?: Date;
  deviceId?: string;
}) {
  const { designId, tokenOverrides } = resolveDesign(settings);
  const effectiveNow = useMemo(() => now ?? new Date(), [now]);
  const data = useSchedulePanelData({
    settings,
    schedule,
    deviceId,
    now: effectiveNow,
  });
  const context = buildRenderContext(slide, deviceId);
  return (
    <DesignHost
      slideType="content-panel"
      data={data}
      context={context}
      enabled
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<UnavailableSlide reason="Plan nicht verfügbar" />}
    />
  );
}
