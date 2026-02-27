import { useEffect, useRef, useState } from 'react';
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
import { buildUploadUrl, getMediaUploadUrl } from '@/utils/mediaUrl';

interface SlideRendererProps {
  slide: SlideConfig;
  onVideoEnded?: () => void;
  schedule?: Schedule;
  settings?: Settings;
  media?: Media[];
}

export function SlideRenderer({
  slide,
  onVideoEnded,
  schedule: scheduleProp,
  settings: settingsProp,
  media: mediaProp,
}: SlideRendererProps) {
  const { schedule: scheduleFromQuery } = useSchedule();
  const { settings: settingsFromQuery } = useSettings();
  const { data: mediaFromQuery } = useMedia();

  const schedule = scheduleProp || scheduleFromQuery;
  const settings = settingsProp || settingsFromQuery;
  const media = mediaProp || mediaFromQuery;

  if (!schedule || !settings) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Lädt...</div>;
  }

  switch (slide.type) {
    case 'content-panel':
      return <ContentPanelSlide schedule={schedule} settings={settings} slide={slide} />;

    case 'sauna-detail':
      return (
        <SaunaDetailSlide
          sauna={getSauna(settings, slide.saunaId)}
          slide={slide}
          schedule={schedule}
          settings={settings}
          media={media}
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

function SaunaDetailSlide({
  sauna,
  slide,
  schedule,
  settings,
  media,
}: {
  sauna?: Sauna;
  slide: SlideConfig;
  schedule: Schedule;
  settings: Settings;
  media?: Media[];
}) {
  if (!sauna) {
    return <div className="w-full h-full bg-gray-900 text-white flex items-center justify-center">Sauna nicht gefunden</div>;
  }

  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const fonts = settings.fonts || defaults.fonts!;

  const designStyle = settings.designStyle || 'modern-wellness';

  if ((designStyle === 'modern-wellness' || designStyle === 'modern-timeline') && schedule) {
    return <SaunaDetailDashboard schedule={schedule} settings={settings} saunaId={sauna.id} />;
  }

  // Find image filename if imageId is set
  const imageUrl = getMediaUploadUrl(media, sauna.imageId);

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
        src={buildUploadUrl(media.filename)}
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
        src={buildUploadUrl(media.filename)}
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

function InfosSlide({ slide, settings, media }: { slide: SlideConfig; settings: Settings; media?: Media[] }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => setCompact(el.clientHeight < 250);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accentGold = (theme as any).accentGold || theme.accent || '#A68A64';
  const accentGreen = (theme as any).accentGreen || (theme as any).timeColBg || '#8F9779';
  const textMain = (theme as any).textMain || theme.fg || '#3E2723';
  const textMuted = (theme as any).textMuted || theme.fg || '#5D4037';

  const infos: InfoItem[] = (settings as any).infos || [];
  const selected = slide.infoId ? infos.find((i) => i.id === slide.infoId) : null;
  const fallback = infos[0] || { id: 'default', title: 'Wellness Tipp', text: 'Bitte beachten Sie unsere Hinweise für einen angenehmen Aufenthalt.' };
  const info = selected || fallback;
  const imageUrl = info.imageId ? getMediaUploadUrl(media, info.imageId) : null;
  const isBackground = info.imageMode === 'background' && imageUrl;

  // Compact: no image, no icon-box — just title + text, maximising readable space
  if (compact) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col justify-center overflow-hidden"
        style={{ padding: '6px 14px' }}
      >
        <h4
          className="font-black uppercase truncate shrink-0"
          style={{ fontSize: '11px', letterSpacing: '0.25em', color: accentGold, marginBottom: '4px' }}
        >
          <ShieldCheck style={{ width: '13px', height: '13px', color: accentGreen, display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
          {info.title || 'Info'}
        </h4>
        <p
          className="font-bold uppercase tracking-tight italic border-l-3 overflow-hidden"
          style={{
            fontSize: '14px',
            lineHeight: '1.35',
            paddingLeft: '8px',
            borderLeft: `3px solid ${accentGreen}30`,
            color: isBackground ? 'rgba(255,255,255,0.9)' : textMuted,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {info.text}
        </p>
      </div>
    );
  }

  if (isBackground) {
    return (
      <div ref={containerRef} className="w-full h-full relative flex flex-col justify-end overflow-hidden">
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative z-10" style={{ padding: 'clamp(12px,3%,32px)' }}>
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-sm shrink-0"
              style={{
                padding: 'clamp(6px, 1%, 14px)',
                backgroundColor: `${accentGreen}20`,
                borderColor: `${accentGreen}30`,
              }}
            >
              <ShieldCheck style={{ width: 'clamp(16px, 2.5vw, 32px)', height: 'clamp(16px, 2.5vw, 32px)', color: accentGreen }} />
            </div>
            <h4
              className="font-black uppercase truncate"
              style={{ fontSize: 'clamp(10px, 1.5vw, 20px)', letterSpacing: '0.3em', color: '#FFFFFF' }}
            >
              {info.title || 'Info'}
            </h4>
          </div>
          <p
            className="font-bold uppercase tracking-tight italic border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(14px, 2.2vw, 32px)',
              lineHeight: '1.6',
              paddingLeft: 'clamp(8px, 1%, 16px)',
              color: 'rgba(255,255,255,0.9)',
              borderLeftColor: `${accentGreen}40`,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {info.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full flex items-center overflow-hidden" style={{ padding: 'clamp(8px, 2%, 24px)' }}>
      <div className="flex items-center w-full" style={{ gap: imageUrl ? 'clamp(12px,3%,32px)' : '0' }}>
        {imageUrl && (
          <div className="shrink-0 rounded-xl overflow-hidden shadow-md" style={{ width: '35%', maxHeight: '80%' }}>
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
            <div
              className="rounded-lg border shadow-sm shrink-0"
              style={{
                padding: 'clamp(6px, 1%, 14px)',
                backgroundColor: `${accentGreen}10`,
                borderColor: `${accentGreen}20`,
              }}
            >
              <ShieldCheck style={{ width: 'clamp(16px, 2.5vw, 32px)', height: 'clamp(16px, 2.5vw, 32px)', color: accentGreen }} />
            </div>
            <h4
              className="font-black uppercase truncate"
              style={{ fontSize: 'clamp(10px, 1.5vw, 20px)', letterSpacing: '0.3em', color: accentGold }}
            >
              {info.title || 'Info'}
            </h4>
          </div>
          <p
            className="font-bold uppercase tracking-tight italic border-l-4 overflow-hidden"
            style={{
              fontSize: 'clamp(14px, 2.2vw, 32px)',
              lineHeight: '1.6',
              paddingLeft: 'clamp(8px, 1%, 16px)',
              color: textMuted,
              borderLeftColor: `${accentGreen}20`,
              display: '-webkit-box',
              WebkitLineClamp: 6,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {info.text}
          </p>
        </div>
      </div>
      <div className="sr-only" style={{ color: textMain }} />
    </div>
  );
}

function EventsSlide({ settings, media }: { settings: Settings; media?: Media[] }) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<'compact' | 'vertical' | 'horizontal'>('horizontal');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const h = el.clientHeight;
      const w = el.clientWidth;
      if (h < 250) setLayout('compact');
      else if (h > w * 0.8) setLayout('vertical');
      else setLayout('horizontal');
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const accentGold = (theme as any).accentGold || theme.accent || '#A68A64';
  const accentGreen = (theme as any).accentGreen || (theme as any).timeColBg || '#8F9779';
  const textMain = (theme as any).textMain || theme.fg || '#3E2723';
  const cardBg = (theme as any).cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = (theme as any).cardBorder || theme.gridTable || '#EBE5D3';

  const events = getUpcomingOrActiveEvents(settings, new Date());
  const isCompact = layout === 'compact';
  const isVertical = layout === 'vertical';

  // Compact: no icon-box, no event images — just inline title + event cards with text only
  if (isCompact) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col justify-center overflow-hidden" style={{ padding: '6px 14px' }}>
        <h4
          className="font-black uppercase shrink-0"
          style={{ fontSize: '11px', letterSpacing: '0.25em', color: accentGold, marginBottom: '6px' }}
        >
          <Calendar style={{ width: '13px', height: '13px', color: accentGold, display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
          Events
        </h4>
        <div className="flex gap-2 min-w-0">
          {events.length === 0 ? (
            <div
              className="flex-1 rounded-xl border"
              style={{ padding: '6px 10px', backgroundColor: withAlpha(cardBg, 0.35), borderColor: withAlpha(cardBorder, 0.6), color: textMain }}
            >
              <div className="font-black uppercase leading-tight" style={{ fontSize: '13px' }}>Keine Events</div>
            </div>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="flex-1 rounded-xl border overflow-hidden"
                style={{ padding: '6px 10px', backgroundColor: withAlpha(cardBg, 0.35), borderColor: withAlpha(cardBorder, 0.6) }}
              >
                <div className="font-black uppercase tracking-wider" style={{ fontSize: '9px', color: accentGreen, marginBottom: '2px' }}>
                  {formatEventDateDE(event)}
                </div>
                <div className="font-black uppercase leading-tight truncate" style={{ fontSize: '13px', color: textMain, marginBottom: '1px' }}>
                  {event.name}
                </div>
                <div className="font-bold uppercase" style={{ fontSize: '10px', color: withAlpha(textMain, 0.58) }}>
                  {formatEventTimeRangeDE(event)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ padding: 'clamp(12px, 2.5%, 28px)', justifyContent: 'center' }}
    >
      <div className="flex items-center shrink-0" style={{ gap: 'clamp(8px,1.5%,20px)', marginBottom: 'clamp(6px,1%,16px)' }}>
        <div
          className="rounded-xl border shadow-sm shrink-0"
          style={{ padding: 'clamp(6px, 1%, 14px)', backgroundColor: `${accentGold}10`, borderColor: `${accentGold}20` }}
        >
          <Calendar style={{ width: 'clamp(16px, 2.5vw, 32px)', height: 'clamp(16px, 2.5vw, 32px)', color: accentGold }} />
        </div>
        <h4
          className="font-black uppercase"
          style={{ fontSize: 'clamp(10px, 1.5vw, 20px)', letterSpacing: '0.3em', color: accentGold }}
        >
          Events
        </h4>
      </div>

      <div
        className={isVertical ? 'flex flex-col overflow-auto' : 'flex'}
        style={{ gap: isVertical ? 'clamp(8px, 1.5%, 16px)' : 'clamp(8px, 1.5%, 24px)' }}
      >
        {events.length === 0 ? (
          <div
            className="flex-1 rounded-2xl border"
            style={{ padding: 'clamp(8px, 1.5%, 20px)', backgroundColor: withAlpha(cardBg, 0.35), borderColor: withAlpha(cardBorder, 0.6), color: textMain }}
          >
            <div className="font-black uppercase leading-tight mb-1" style={{ fontSize: 'clamp(12px, 1.8vw, 24px)' }}>Keine Events geplant</div>
            <div className="font-bold uppercase opacity-70" style={{ fontSize: 'clamp(8px, 1.2vw, 14px)' }}>Demnaechst mehr</div>
          </div>
        ) : (
          events.map((event) => {
            const eventImageUrl = event.imageId ? getMediaUploadUrl(media, event.imageId) : null;
            return (
              <div
                key={event.id}
                className={`rounded-2xl border overflow-hidden ${isVertical ? '' : 'flex-1'} ${isVertical && eventImageUrl ? 'flex' : ''}`}
                style={{ backgroundColor: withAlpha(cardBg, 0.35), borderColor: withAlpha(cardBorder, 0.6) }}
              >
                {eventImageUrl && (
                  isVertical ? (
                    <div className="w-24 shrink-0 overflow-hidden">
                      <img src={eventImageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="relative overflow-hidden" style={{ height: 'clamp(40px, 5vw, 80px)' }}>
                      <img src={eventImageUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                  )
                )}
                <div style={{ padding: 'clamp(8px, 1.5%, 20px)' }} className="min-w-0 flex-1">
                  <div className="font-black uppercase tracking-widest mb-0.5" style={{ fontSize: 'clamp(9px, 1.3vw, 18px)', color: accentGreen }}>
                    {formatEventDateDE(event)}
                  </div>
                  <div className="font-black uppercase leading-tight mb-0.5 truncate" style={{ fontSize: 'clamp(12px, 1.8vw, 24px)', color: textMain }}>
                    {event.name}
                  </div>
                  <div className="font-bold uppercase" style={{ fontSize: 'clamp(9px, 1.2vw, 16px)', color: withAlpha(textMain, 0.58) }}>
                    {formatEventTimeRangeDE(event)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
