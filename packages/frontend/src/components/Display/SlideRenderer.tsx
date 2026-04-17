import { memo } from 'react';
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
import { useInfoPanelData, useMediaImageData, useMediaVideoData } from '@/slides/data';
import { DesignHost, DEFAULT_DESIGN_ID, isKnownDesignId } from '@/designs';

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
        return <ContentPanelSlide schedule={schedule} settings={settings} slide={slide} now={now} deviceId={deviceId} />;

      case 'sauna-detail':
        return (
          <SaunaDetailSlide
            sauna={getSauna(settings, slide.saunaId)}
            slide={slide}
            schedule={schedule}
            settings={settings}
            media={media}
            deviceId={deviceId}
          />
        );

      case 'media-image':
        return <MediaImageSlide media={media} slide={slide} />;

      case 'media-video':
        return <MediaVideoSlide media={media} slide={slide} onVideoEnded={onVideoEnded} />;

      case 'infos':
        return <InfosSlideDispatch slide={slide} settings={settings} media={media} deviceId={deviceId} />;

      case 'events':
        return <EventsSlide settings={settings} media={media} />;

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
  const useDesignPacks = settings.display?.useDesignPacks === true;
  const configuredId = settings.display?.designPackId;
  const designId = isKnownDesignId(configuredId) ? configuredId : DEFAULT_DESIGN_ID;

  const data = useInfoPanelData({ settings, infoId: slide.infoId, media });

  const context: SlideRenderContext = {
    zoneId: slide.zoneId ?? 'default',
    durationMs: (slide.duration ?? 5) * 1000,
    transitionsEnabled: true,
    locale: 'de-DE',
    deviceId,
  };

  return (
    <DesignHost
      slideType="infos"
      data={data}
      context={context}
      enabled={useDesignPacks}
      designId={designId}
      fallback={<InfosSlide slide={slide} settings={settings} media={media} />}
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
