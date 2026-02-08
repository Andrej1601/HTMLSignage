import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import type { SlideConfig } from '@/types/slideshow.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { OverviewSlide } from './OverviewSlide';
import { ScheduleGridSlide } from './ScheduleGridSlide';
import { SaunaDetailDashboard } from './SaunaDetailDashboard';
import { Flame } from 'lucide-react';
import { getDefaultSettings } from '@/types/settings.types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface SlideRendererProps {
  slide: SlideConfig;
  onVideoEnded?: () => void;
}

export function SlideRenderer({ slide, onVideoEnded }: SlideRendererProps) {
  const { schedule } = useSchedule();
  const { settings } = useSettings();
  const { data: media } = useMedia();

  if (!schedule || !settings) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Lädt...</div>;
  }

  switch (slide.type) {
    case 'content-panel':
      return <ContentPanelSlide schedule={schedule} settings={settings} slide={slide} />;

    case 'sauna-detail':
      return <SaunaDetailSlide sauna={getSauna(settings, slide.saunaId)} slide={slide} />;

    case 'media-image':
      return <MediaImageSlide media={getMedia(media, slide.mediaId)} slide={slide} />;

    case 'media-video':
      return <MediaVideoSlide media={getMedia(media, slide.mediaId)} slide={slide} onVideoEnded={onVideoEnded} />;

    case 'sauna-overview':
      return <SaunaOverviewSlide saunas={settings.saunas || []} slide={slide} />;

    case 'current-aufguss':
      return <CurrentAufgussSlide slide={slide} />;

    default:
      return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Unbekannter Slide-Typ</div>;
  }
}

// Helper functions
function getSauna(settings: Settings, saunaId?: string): Sauna | undefined {
  return settings.saunas?.find(s => s.id === saunaId);
}

function getMedia(media: Media[] | undefined, mediaId?: string): Media | undefined {
  return media?.find(m => m.id === mediaId);
}

// Individual Slide Components

function ContentPanelSlide({ schedule, settings, slide }: { schedule: Schedule; settings: Settings; slide: SlideConfig }) {
  // Use modern design for 'modern-wellness' designStyle
  const designStyle = settings.designStyle || 'classic';

  if (designStyle === 'modern-wellness') {
    return <ScheduleGridSlide schedule={schedule} settings={settings} />;
  }

  return (
    <div className="w-full h-full">
      {slide.showTitle && slide.title && (
        <div className="absolute top-0 left-0 right-0 bg-spa-primary text-white p-6 z-10">
          <h2 className="text-4xl font-bold">{slide.title}</h2>
        </div>
      )}
      <OverviewSlide schedule={schedule} settings={settings} />
    </div>
  );
}

function SaunaDetailSlide({ sauna, slide }: { sauna?: Sauna; slide: SlideConfig }) {
  const { schedule } = useSchedule();
  const { settings } = useSettings();
  const { data: media } = useMedia();

  if (!sauna) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Sauna nicht gefunden</div>;
  }

  const defaults = getDefaultSettings();
  const theme = settings?.theme || defaults.theme!;
  const fonts = settings?.fonts || defaults.fonts!;

  // Use modern design for 'modern-wellness' designStyle
  const designStyle = settings?.designStyle || 'classic';

  if (designStyle === 'modern-wellness' && schedule) {
    return <SaunaDetailDashboard schedule={schedule} settings={settings!} saunaId={sauna.id} />;
  }

  // Find image filename if imageId is set
  const saunaImage = sauna.imageId ? media?.find((m: Media) => m.id === sauna.imageId) : null;
  const imageUrl = saunaImage ? `${API_URL}/uploads/${saunaImage.filename}` : null;

  return (
    <div
      className="w-full h-screen flex items-center justify-center p-16"
      style={{
        backgroundColor: theme.bg,
        backgroundImage: imageUrl ? `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-6xl w-full">
        {/* Card-Style Container */}
        <div
          className="rounded-3xl p-12 shadow-2xl backdrop-blur-sm"
          style={{
            backgroundColor: imageUrl ? 'rgba(255, 255, 255, 0.95)' : theme.cellBg,
            borderLeft: `12px solid ${sauna.color || theme.accent}`,
          }}
        >
          {/* Title */}
          <h1
            className="font-bold mb-6"
            style={{
              fontSize: `${(fonts.h1Scale || 1.5) * 3}rem`,
              color: sauna.color || theme.fg,
            }}
          >
            {slide.title || sauna.name}
          </h1>

          {/* Subtitle / Description */}
          {sauna.description && (
            <p
              className="mb-8"
              style={{
                fontSize: `${(fonts.fontScale || 1) * 1.5}rem`,
                color: theme.fg,
                opacity: 0.8,
              }}
            >
              {sauna.description}
            </p>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-8 mb-8">
            {sauna.info?.temperature && (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${sauna.color || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: sauna.color || theme.fg,
                  }}
                >
                  {sauna.info.temperature}°C
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Temperatur
                </div>
              </div>
            )}

            {sauna.info?.humidity && (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${sauna.color || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: sauna.color || theme.fg,
                  }}
                >
                  {sauna.info.humidity}%
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Luftfeuchtigkeit
                </div>
              </div>
            )}

            {sauna.info?.capacity && (
              <div
                className="text-center p-6 rounded-2xl"
                style={{
                  backgroundColor: `${sauna.color || theme.accent}20`,
                }}
              >
                <div
                  className="font-bold"
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 4}rem`,
                    color: sauna.color || theme.fg,
                  }}
                >
                  {sauna.info.capacity}
                </div>
                <div
                  style={{
                    fontSize: `${(fonts.fontScale || 1) * 1.2}rem`,
                    opacity: 0.7,
                    marginTop: '0.5rem',
                  }}
                >
                  Personen
                </div>
              </div>
            )}
          </div>

          {/* Features as Badges */}
          {sauna.info?.features && sauna.info.features.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {sauna.info.features.map((feature, i) => (
                <span
                  key={i}
                  className="px-6 py-3 rounded-full font-semibold"
                  style={{
                    backgroundColor: sauna.color || theme.flame,
                    color: '#FFFFFF',
                    fontSize: `${(fonts.badgeTextScale || 0.85) * 1.5}rem`,
                  }}
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          {/* Temperature indicator with flames */}
          {sauna.info?.temperature && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({
                length: Math.min(4, Math.floor(sauna.info.temperature / 25))
              }).map((_, i) => (
                <Flame
                  key={i}
                  className="w-12 h-12"
                  style={{ color: theme.flame }}
                  fill={theme.flame}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaImageSlide({ media, slide }: { media?: Media; slide: SlideConfig }) {
  if (!media) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Bild nicht gefunden</div>;
  }

  return (
    <div className="w-full h-full relative">
      <img
        src={`${API_URL}/uploads/${media.filename}`}
        alt={media.originalName}
        className="w-full h-full object-cover"
      />
      {slide.showTitle && slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
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

  return (
    <div className="w-full h-full relative bg-black">
      <video
        src={`${API_URL}/uploads/${media.filename}`}
        className="w-full h-full object-contain"
        autoPlay
        loop={shouldLoop}
        muted
        onEnded={onVideoEnded}
      />
      {slide.showTitle && slide.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
          <h2 className="text-5xl font-bold text-white">{slide.title}</h2>
        </div>
      )}
    </div>
  );
}

function SaunaOverviewSlide({ saunas, slide }: { saunas: Sauna[]; slide: SlideConfig }) {
  const { data: media } = useMedia();
  const visibleSaunas = saunas.filter(s => s.status !== 'hidden');

  return (
    <div className="w-full h-full bg-spa-bg-primary p-12">
      {slide.showTitle && slide.title && (
        <h1 className="text-6xl font-bold text-spa-text-primary mb-12 text-center">{slide.title}</h1>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
        {visibleSaunas.map(sauna => {
          // Find image filename if imageId is set
          const saunaImage = sauna.imageId ? media?.find((m: Media) => m.id === sauna.imageId) : null;
          const imageUrl = saunaImage ? `${API_URL}/uploads/${saunaImage.filename}` : null;

          return (
            <div
              key={sauna.id}
              className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center"
              style={{ borderTop: `8px solid ${sauna.color || '#8B6F47'}` }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={sauna.name}
                  className="w-full h-48 object-cover rounded-lg mb-6"
                />
              )}

              <h2 className="text-4xl font-bold text-spa-text-primary mb-4 text-center">
                {sauna.name}
              </h2>

              <div className="flex gap-6 text-center">
                {sauna.info?.temperature && (
                  <div>
                    <div className="text-3xl font-bold" style={{ color: sauna.color || '#8B6F47' }}>
                      {sauna.info.temperature}°C
                    </div>
                  </div>
                )}
                {sauna.info?.humidity && (
                  <div>
                    <div className="text-3xl font-bold" style={{ color: sauna.color || '#8B6F47' }}>
                      {sauna.info.humidity}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurrentAufgussSlide({ slide }: { slide: SlideConfig }) {
  // Get current time and find current/next aufguss
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // TODO: Implement logic to find current/next aufguss from schedule
  // For now, show placeholder

  return (
    <div className="w-full h-full bg-gradient-to-br from-spa-primary to-spa-primary-dark flex flex-col items-center justify-center p-12 text-white">
      <div className="text-8xl font-bold mb-8">{currentTime}</div>

      {slide.showTitle && slide.title && (
        <h1 className="text-6xl font-bold mb-12">{slide.title}</h1>
      )}

      <div className="text-4xl text-center mb-8">
        Aktueller Aufguss
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 max-w-4xl">
        <h2 className="text-7xl font-bold mb-6">Finnische Sauna</h2>
        <p className="text-3xl mb-8">Classic Aufguss</p>
        <div className="text-2xl opacity-80">
          15:00 Uhr • 15 Minuten
        </div>
      </div>
    </div>
  );
}
