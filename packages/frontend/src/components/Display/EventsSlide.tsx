import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getDefaultSettings } from '@/types/settings.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { Calendar } from 'lucide-react';
import { formatEventDateDE, formatEventTimeRangeDE, getUpcomingOrActiveEvents, withAlpha } from './wellnessDisplayUtils';
import { ResilientImage } from './ResilientImage';

interface EventsSlideProps {
  settings: Settings;
  media?: Media[];
}

export function EventsSlide({ settings, media }: EventsSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const { containerRef, layout } = useResponsiveLayout();

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = theme.cardBorder || theme.gridTable || '#EBE5D3';

  const events = getUpcomingOrActiveEvents(settings, new Date());
  const isCompact = layout === 'compact';
  const isVertical = layout === 'vertical';

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
                      <ResilientImage
                        src={eventImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full bg-spa-bg-secondary" />}
                      />
                    </div>
                  ) : (
                    <div className="relative overflow-hidden" style={{ height: 'clamp(40px, 5vw, 80px)' }}>
                      <ResilientImage
                        src={eventImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full bg-spa-bg-secondary" />}
                      />
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
