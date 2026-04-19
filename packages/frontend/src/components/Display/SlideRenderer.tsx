import { memo, useMemo } from 'react';
import { type SlideConfig } from '@/types/slideshow.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { normalizeSaunaNameKey } from '@/types/schedule.types';
import type { SlideRenderContext } from '@htmlsignage/design-sdk';
import { DisplayContentPanel } from './DisplayContentPanel';
import { DisplaySaunaDetailSlide } from './DisplaySaunaDetailSlide';
import { InfosSlide } from './InfosSlide';
import { EventsSlide } from './EventsSlide';
import { ResilientImage } from './ResilientImage';
import { ResilientVideo } from './ResilientVideo';
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
        return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Unbekannter Slide-Typ</div>;
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

// Helper functions
function getSauna(settings: Settings, saunaId?: string): Sauna | undefined {
  if (!saunaId) return undefined;
  const list = settings.saunas || [];
  return (
    list.find((s) => s.id === saunaId) ||
    list.find((s) => s.name === saunaId) ||
    list.find((s) => normalizeSaunaNameKey(s.name) === normalizeSaunaNameKey(saunaId))
  );
}

function resolveDesignFlag(settings: Settings): {
  enabled: boolean;
  designId: DesignId;
  tokenOverrides: ReturnType<typeof themeToTokenOverrides>;
} {
  const enabled = settings.display?.useDesignPacks === true;
  const configuredId = settings.display?.designPackId;
  const designId = isKnownDesignId(configuredId) ? configuredId : DEFAULT_DESIGN_ID;
  const tokenOverrides = themeToTokenOverrides(settings.theme);
  return { enabled, designId, tokenOverrides };
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
  const data = useInfoPanelData({ settings, infoId: slide.infoId, media });
  const context = buildRenderContext(slide, deviceId);

  return (
    <DesignHost
      slideType="infos"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<InfosSlide slide={slide} settings={settings} media={media} />}
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
  const data = useMediaImageData({ slide, media });
  const context = buildRenderContext(slide, deviceId);

  const legacy = <MediaImageSlide media={media} slide={slide} />;
  if (!data) return legacy;

  return (
    <DesignHost
      slideType="media-image"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={legacy}
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
  const data = useMediaVideoData({ slide, media });
  const context = buildRenderContext(slide, deviceId, { onVideoEnded });

  const legacy = <MediaVideoSlide media={media} slide={slide} onVideoEnded={onVideoEnded} />;
  if (!data) return legacy;

  return (
    <DesignHost
      slideType="media-video"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={legacy}
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
  const effectiveNow = useMemo(() => now ?? new Date(), [now]);
  const data = useEventsPanelData({ settings, media, now: effectiveNow });
  const context = buildRenderContext(slide, deviceId);

  return (
    <DesignHost
      slideType="events"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={<EventsSlide settings={settings} media={media} />}
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
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

  const legacy = (
    <SaunaDetailSlide
      sauna={getSauna(settings, slide.saunaId)}
      slide={slide}
      schedule={schedule}
      settings={settings}
      media={media}
      deviceId={deviceId}
    />
  );

  if (!data) return legacy;

  return (
    <DesignHost
      slideType="sauna-detail"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={legacy}
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
  const { enabled, designId, tokenOverrides } = resolveDesignFlag(settings);
  const effectiveNow = useMemo(() => now ?? new Date(), [now]);
  const data = useSchedulePanelData({
    settings,
    schedule,
    deviceId,
    now: effectiveNow,
  });
  const context = buildRenderContext(slide, deviceId);

  // The pack's SchedulePanelRenderer dispatches on `data.styleHint` and
  // implements all three host styles (`list` / `matrix` / `timeline`) so
  // the large and small zones can render identically. When the design
  // pack flag is off, DesignHost falls back to ContentPanelSlide which
  // uses the legacy DisplayContentPanel dispatcher.
  return (
    <DesignHost
      slideType="content-panel"
      data={data}
      context={context}
      enabled={enabled}
      designId={designId}
      tokenOverrides={tokenOverrides}
      fallback={
        <ContentPanelSlide schedule={schedule} settings={settings} slide={slide} now={now} deviceId={deviceId} />
      }
    />
  );
}

// Individual Slide Components

function ContentPanelSlide({
  schedule,
  settings,
  slide,
  now,
  deviceId,
}: {
  schedule: Schedule;
  settings: Settings;
  slide: SlideConfig;
  now?: Date;
  deviceId?: string;
}) {
  return <DisplayContentPanel schedule={schedule} settings={settings} slide={slide} now={now} deviceId={deviceId} />;
}

function SaunaDetailSlide({
  sauna,
  slide,
  schedule,
  settings,
  media,
  deviceId,
}: {
  sauna?: Sauna;
  slide: SlideConfig;
  schedule: Schedule;
  settings: Settings;
  media?: Media[];
  deviceId?: string;
}) {
  if (!sauna) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Sauna nicht gefunden</div>;
  }

  return (
    <DisplaySaunaDetailSlide
      sauna={sauna}
      slide={slide}
      schedule={schedule}
      settings={settings}
      media={media}
      deviceId={deviceId}
    />
  );
}

function MediaImageSlide({ media, slide }: { media?: Media[]; slide: SlideConfig }) {
  const data = useMediaImageData({ slide, media });
  if (!data) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Bild nicht gefunden</div>;
  }

  return (
    <div className="w-full h-full relative bg-black">
      <ResilientImage
        src={data.url}
        alt={data.altText ?? ''}
        className={`w-full h-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        fallback={
          <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
            Bild konnte nicht geladen werden
          </div>
        }
      />
      {slide.showTitle && slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-8">
          <h2 className="text-5xl font-bold text-white">{slide.title}</h2>
        </div>
      )}
    </div>
  );
}

function MediaVideoSlide({ media, slide, onVideoEnded }: { media?: Media[]; slide: SlideConfig; onVideoEnded?: () => void }) {
  const data = useMediaVideoData({ slide, media });
  if (!data) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Video nicht gefunden</div>;
  }

  const shouldLoop = data.playback === 'loop-duration' || data.playback === 'duration';

  return (
    <div className="w-full h-full relative bg-black">
      <ResilientVideo
        src={data.url}
        className={`w-full h-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        autoPlay
        loop={shouldLoop}
        muted={data.mutedByDefault}
        playsInline
        onEnded={onVideoEnded}
        fallback={
          <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">
            Video konnte nicht geladen werden
          </div>
        }
      />
      {slide.showTitle && slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-8">
          <h2 className="text-5xl font-bold text-white">{slide.title}</h2>
        </div>
      )}
    </div>
  );
}
