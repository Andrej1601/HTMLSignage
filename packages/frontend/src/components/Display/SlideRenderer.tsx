import { memo } from 'react';
import { getEffectiveMediaFit, type SlideConfig } from '@/types/slideshow.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { normalizeSaunaNameKey } from '@/types/schedule.types';
import { DisplayContentPanel } from './DisplayContentPanel';
import { DisplaySaunaDetailSlide } from './DisplaySaunaDetailSlide';
import { InfosSlide } from './InfosSlide';
import { EventsSlide } from './EventsSlide';
import { ResilientImage } from './ResilientImage';
import { ResilientVideo } from './ResilientVideo';
import { SlideErrorBoundary } from './SlideErrorBoundary';
import { buildUploadUrl } from '@/utils/mediaUrl';

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
        return <MediaImageSlide media={getMedia(media, slide.mediaId)} slide={slide} />;

      case 'media-video':
        return <MediaVideoSlide media={getMedia(media, slide.mediaId)} slide={slide} onVideoEnded={onVideoEnded} />;

      case 'infos':
        return <InfosSlide slide={slide} settings={settings} media={media} />;

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

function getMedia(media: Media[] | undefined, mediaId?: string): Media | undefined {
  return media?.find(m => m.id === mediaId);
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

function MediaImageSlide({ media, slide }: { media?: Media; slide: SlideConfig }) {
  if (!media) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Bild nicht gefunden</div>;
  }

  const fitMode = getEffectiveMediaFit(slide);

  return (
    <div className="w-full h-full relative bg-black">
      <ResilientImage
        src={buildUploadUrl(media.filename)}
        alt={media.originalName}
        className={`w-full h-full ${fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
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

function MediaVideoSlide({ media, slide, onVideoEnded }: { media?: Media; slide: SlideConfig; onVideoEnded?: () => void }) {
  if (!media) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Video nicht gefunden</div>;
  }

  const shouldLoop = slide.videoPlayback === 'loop-duration' || slide.videoPlayback === 'duration';
  const fitMode = getEffectiveMediaFit(slide);

  return (
    <div className="w-full h-full relative bg-black">
      <ResilientVideo
        src={buildUploadUrl(media.filename)}
        className={`w-full h-full ${fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
        autoPlay
        loop={shouldLoop}
        muted
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
