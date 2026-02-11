import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import type { SlideConfig } from '@/types/slideshow.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import type { Media } from '@/types/media.types';
import { normalizeSaunaNameKey } from '@/types/schedule.types';
import { OverviewSlide } from './OverviewSlide';
import { ScheduleGridSlide } from './ScheduleGridSlide';
import { TimelineScheduleSlide } from './TimelineScheduleSlide';
import { SaunaDetailDashboard } from './SaunaDetailDashboard';
import { Calendar, Flame, ShieldCheck } from 'lucide-react';
import { getDefaultSettings } from '@/types/settings.types';
import type { InfoItem } from '@/types/settings.types';
import { formatEventDateDE, formatEventTimeRangeDE, getUpcomingOrActiveEvents, withAlpha } from './wellnessDisplayUtils';

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

    case 'infos':
      return <InfosSlide slide={slide} settings={settings} />;

    case 'events':
      return <EventsSlide settings={settings} />;

    default:
      return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Unbekannter Slide-Typ</div>;
  }
}

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

function ContentPanelSlide({ schedule, settings, slide }: { schedule: Schedule; settings: Settings; slide: SlideConfig }) {
  const designStyle = settings.designStyle || 'modern-wellness';

  if (designStyle === 'modern-wellness') {
    return <ScheduleGridSlide schedule={schedule} settings={settings} />;
  }
  if (designStyle === 'modern-timeline') {
    return <TimelineScheduleSlide schedule={schedule} settings={settings} />;
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

  const designStyle = settings?.designStyle || 'modern-wellness';

  if ((designStyle === 'modern-wellness' || designStyle === 'modern-timeline') && schedule) {
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

function InfosSlide({ slide, settings }: { slide: SlideConfig; settings: Settings }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;

  const accentGold = (theme as any).accentGold || theme.accent || '#A68A64';
  const accentGreen = (theme as any).accentGreen || (theme as any).timeColBg || '#8F9779';
  const textMain = (theme as any).textMain || theme.fg || '#3E2723';
  const textMuted = (theme as any).textMuted || theme.fg || '#5D4037';

  const infos: InfoItem[] = (settings as any).infos || [];
  const selected = slide.infoId ? infos.find((i) => i.id === slide.infoId) : null;
  const fallback = infos[0] || { id: 'default', title: 'Wellness Tipp', text: 'Bitte beachten Sie unsere Hinweise für einen angenehmen Aufenthalt.' };
  const info = selected || fallback;

  return (
    <div className="w-full h-full flex flex-col justify-center">
      <div className="flex items-center gap-4 mb-3">
        <div
          className="p-2.5 rounded-xl border shadow-sm"
          style={{
            backgroundColor: `${accentGreen}10`,
            borderColor: `${accentGreen}20`,
          }}
        >
          <ShieldCheck className="w-5 h-5" style={{ color: accentGreen }} />
        </div>
        <h4 className="text-[11px] font-black uppercase tracking-[0.4em]" style={{ color: accentGold }}>
          {info.title || 'Info'}
        </h4>
      </div>
      <p
        className="text-[15px] leading-relaxed font-bold uppercase tracking-tight italic pl-2 border-l-4"
        style={{
          color: textMuted,
          borderLeftColor: `${accentGreen}20`,
        }}
      >
        {info.text}
      </p>
      <div className="sr-only" style={{ color: textMain }} />
    </div>
  );
}

function EventsSlide({ settings }: { settings: Settings }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;

  const accentGold = (theme as any).accentGold || theme.accent || '#A68A64';
  const accentGreen = (theme as any).accentGreen || (theme as any).timeColBg || '#8F9779';
  const textMain = (theme as any).textMain || theme.fg || '#3E2723';
  const cardBg = (theme as any).cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = (theme as any).cardBorder || theme.gridTable || '#EBE5D3';

  const events = getUpcomingOrActiveEvents(settings, new Date());

  return (
    <div className="w-full h-full flex flex-col justify-center">
      <div className="flex items-center gap-4 mb-3">
        <div
          className="p-2.5 rounded-xl border shadow-sm"
          style={{
            backgroundColor: `${accentGold}10`,
            borderColor: `${accentGold}20`,
          }}
        >
          <Calendar className="w-5 h-5" style={{ color: accentGold }} />
        </div>
        <h4 className="text-[11px] font-black uppercase tracking-[0.4em]" style={{ color: accentGold }}>
          Events
        </h4>
      </div>

      <div className="flex gap-4">
        {events.length === 0 ? (
          <div
            className="flex-1 p-3 rounded-2xl border"
            style={{
              backgroundColor: withAlpha(cardBg, 0.35),
              borderColor: withAlpha(cardBorder, 0.6),
              color: textMain,
            }}
          >
            <div className="text-sm font-black uppercase leading-tight mb-1">Keine Events geplant</div>
            <div className="text-[9px] font-bold uppercase opacity-70">Demnaechst mehr</div>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex-1 p-3 rounded-2xl border"
              style={{
                backgroundColor: withAlpha(cardBg, 0.35),
                borderColor: withAlpha(cardBorder, 0.6),
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: accentGreen }}>
                {formatEventDateDE(event)}
              </div>
              <div className="text-sm font-black uppercase leading-tight mb-1" style={{ color: textMain }}>
                {event.name}
              </div>
              <div className="text-[9px] font-bold uppercase" style={{ color: withAlpha(textMain, 0.58) }}>
                {formatEventTimeRangeDE(event)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
