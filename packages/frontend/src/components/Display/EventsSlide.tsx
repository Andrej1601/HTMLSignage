import { memo } from 'react';
import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getDefaultSettings } from '@/types/settings.types';
import { useDisplayViewportProfile } from './useDisplayViewportProfile';
import { Calendar, Clock3 } from 'lucide-react';
import { withAlpha } from './wellnessDisplayUtils';
import { ResilientImage } from './ResilientImage';
import {
  buildEventPresentationData,
  buildEventsSlideLayout,
  type EventPresentation,
} from './eventsSlideUtils';

interface EventsSlideProps {
  settings: Settings;
  media?: Media[];
}

const TWO_LINE_CLAMP = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
  overflow: 'hidden',
};

const THREE_LINE_CLAMP = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 3,
  overflow: 'hidden',
};

const FOUR_LINE_CLAMP = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 4,
  overflow: 'hidden',
};

function EventStatusBadge({
  label,
  background,
  textColor,
  compact = false,
}: {
  label: string;
  background: string;
  textColor: string;
  compact?: boolean;
}) {
  return (
    <span
      className="shrink-0 rounded-full border font-black uppercase"
      style={{
        padding: compact ? '6px 10px' : '8px 14px',
        fontSize: compact ? 'clamp(8px, 0.82vw, 10px)' : 'clamp(9px, 1vw, 12px)',
        letterSpacing: compact ? '0.16em' : '0.18em',
        color: textColor,
        backgroundColor: background,
        borderColor: withAlpha(background, 0.94),
        boxShadow: `0 12px 28px ${withAlpha(background, 0.22)}`,
      }}
    >
      {label}
    </span>
  );
}

function EventTimeChip({
  label,
  textMuted,
  background,
  border,
  compact = false,
}: {
  label: string;
  textMuted: string;
  background: string;
  border: string;
  compact?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border font-bold uppercase"
      style={{
        padding: compact ? '7px 11px' : '9px 14px',
        fontSize: compact ? 'clamp(10px, 0.95vw, 12px)' : 'clamp(10px, 1vw, 13px)',
        color: textMuted,
        backgroundColor: withAlpha(background, 0.82),
        borderColor: withAlpha(border, 0.72),
      }}
    >
      <Clock3 style={{ width: compact ? '12px' : '14px', height: compact ? '12px' : '14px' }} />
      {label}
    </div>
  );
}

function SecondaryEventCard({
  event,
  accentGreen,
  textMain,
  textMuted,
  cardBg,
  cardBorder,
  showImage,
  showDescription,
  imagePlacement,
}: {
  event: EventPresentation;
  accentGreen: string;
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  showImage: boolean;
  showDescription: boolean;
  imagePlacement: 'top' | 'side';
}) {
  const sideImage = showImage && imagePlacement === 'side' && Boolean(event.imageUrl);
  const topImage = showImage && imagePlacement === 'top' && Boolean(event.imageUrl);

  return (
    <div
      className={`relative min-h-0 overflow-hidden rounded-[1.55rem] border ${sideImage ? 'grid grid-cols-[minmax(7.5rem,34%)_minmax(0,1fr)]' : 'flex flex-col'}`}
      style={{
        background: `linear-gradient(160deg, ${withAlpha(cardBg, 0.96)} 0%, ${withAlpha(cardBg, 0.76)} 100%)`,
        borderColor: withAlpha(cardBorder, 0.68),
        boxShadow: `0 18px 34px ${withAlpha(textMain, 0.08)}`,
      }}
    >
      {sideImage ? (
        <div className="relative min-h-full overflow-hidden">
          <ResilientImage
            src={event.imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            fallback={<div className="h-full w-full bg-spa-bg-secondary" />}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.02))' }} />
        </div>
      ) : null}

      {topImage ? (
        <div className="relative overflow-hidden" style={{ height: 'clamp(100px, 17vh, 158px)' }}>
          <ResilientImage
            src={event.imageUrl!}
            alt=""
            className="h-full w-full object-cover"
            fallback={<div className="h-full w-full bg-spa-bg-secondary" />}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.92), rgba(255,255,255,0.1))' }} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col justify-between" style={{ padding: 'clamp(12px, 1.8%, 18px)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-black uppercase tracking-widest" style={{ fontSize: 'clamp(8px, 0.92vw, 12px)', color: accentGreen }}>
              {event.dateLabel}
            </div>
            <div className="mt-1.5 font-black uppercase leading-tight" style={{ fontSize: 'clamp(15px, 1.45vw, 22px)', color: textMain, ...TWO_LINE_CLAMP }}>
              {event.name}
            </div>
          </div>
          <EventStatusBadge
            label={event.badgeLabel}
            background={event.badgeBackground}
            textColor={event.badgeTextColor}
            compact
          />
        </div>

        <div className="mt-3 min-w-0">
          <EventTimeChip
            label={event.timeLabel}
            textMuted={textMuted}
            background={cardBg}
            border={cardBorder}
            compact
          />
          {showDescription && event.description ? (
            <p
              className="mt-3"
              style={{
                fontSize: 'clamp(11px, 1.05vw, 14px)',
                lineHeight: 1.5,
                color: textMuted,
                ...(sideImage ? TWO_LINE_CLAMP : THREE_LINE_CLAMP),
              }}
            >
              {event.description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LeadEventCard({
  event,
  textMain,
  textMuted,
  cardBg,
  cardBorder,
  accentGold,
  accentGreen,
  showDescription,
}: {
  event: EventPresentation;
  textMain: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  accentGold: string;
  accentGreen: string;
  showDescription: boolean;
}) {
  const imageMode = Boolean(event.imageUrl);
  const leadTextMain = imageMode ? '#FFFDF8' : textMain;
  const leadTextMuted = imageMode ? withAlpha('#FFFDF8', 0.9) : textMuted;
  const leadDateColor = imageMode ? withAlpha('#F4E7C8', 0.96) : accentGreen;
  const leadChipBackground = imageMode ? withAlpha('#171412', 0.78) : cardBg;
  const leadChipBorder = imageMode ? withAlpha('#FFFDF8', 0.18) : cardBorder;
  const leadHeaderBackground = imageMode ? withAlpha('#171412', 0.72) : withAlpha(cardBg, 0.86);
  const leadHeaderBorder = imageMode ? withAlpha('#FFFDF8', 0.14) : withAlpha(cardBorder, 0.72);

  return (
    <div
      className="relative min-h-0 overflow-hidden rounded-[1.95rem] border"
      style={{
        backgroundColor: withAlpha(cardBg, 0.4),
        borderColor: withAlpha(cardBorder, 0.72),
        boxShadow: `0 30px 60px ${withAlpha(textMain, 0.1)}`,
      }}
    >
      {event.imageUrl ? (
        <>
          <div className="absolute inset-0 overflow-hidden">
            <ResilientImage
              src={event.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              fallback={<div className="h-full w-full bg-spa-bg-secondary" />}
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              background: [
                `linear-gradient(120deg, ${withAlpha('#0E0B09', 0.84)} 0%, ${withAlpha('#0E0B09', 0.48)} 42%, ${withAlpha('#0E0B09', 0.12)} 100%)`,
                `linear-gradient(to top, ${withAlpha('#120F0D', 0.92)} 0%, ${withAlpha('#120F0D', 0.56)} 34%, ${withAlpha('#120F0D', 0.1)} 100%)`,
              ].join(','),
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: [
              `radial-gradient(circle at 18% 22%, ${withAlpha(accentGold, 0.2)} 0%, transparent 34%)`,
              `radial-gradient(circle at 100% 0%, ${withAlpha(accentGreen, 0.18)} 0%, transparent 38%)`,
              `linear-gradient(145deg, ${withAlpha(cardBg, 0.98)} 0%, ${withAlpha(cardBg, 0.88)} 45%, ${withAlpha(accentGold, 0.12)} 100%)`,
            ].join(','),
          }}
        />
      )}

      <div className="relative z-10 flex h-full min-h-0 flex-col justify-between" style={{ padding: 'clamp(16px, 2.4%, 28px)' }}>
        <div className="flex items-start justify-between gap-3">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-2 font-black uppercase"
            style={{
              fontSize: 'clamp(8px, 0.9vw, 11px)',
              letterSpacing: '0.22em',
              color: imageMode ? withAlpha('#FFF6E4', 0.96) : accentGold,
              backgroundColor: leadHeaderBackground,
              borderColor: leadHeaderBorder,
            }}
          >
            <Calendar style={{ width: '13px', height: '13px' }} />
            Events
          </div>

          <EventStatusBadge
            label={event.badgeLabel}
            background={event.badgeBackground}
            textColor={event.badgeTextColor}
          />
        </div>

        <div className="min-w-0">
          <div className="font-black uppercase tracking-[0.24em]" style={{ fontSize: 'clamp(10px, 1.08vw, 14px)', color: leadDateColor }}>
            {event.dateLabel}
          </div>
          <div
            className="mt-3 font-black uppercase leading-[0.94]"
            style={{
              fontSize: 'clamp(26px, 3.3vw, 46px)',
              color: leadTextMain,
              textShadow: event.imageUrl ? `0 16px 34px ${withAlpha('#000000', 0.34)}` : 'none',
              ...TWO_LINE_CLAMP,
            }}
          >
            {event.name}
          </div>

          <div className="mt-4">
            <EventTimeChip
              label={event.timeLabel}
              textMuted={leadTextMuted}
              background={leadChipBackground}
              border={leadChipBorder}
            />
          </div>

          {event.description && showDescription ? (
            <div
              className="mt-4 rounded-[1.35rem] border"
              style={{
                padding: 'clamp(12px, 1.8%, 18px)',
                backgroundColor: imageMode ? withAlpha('#171412', 0.68) : withAlpha(cardBg, 0.82),
                borderColor: imageMode ? withAlpha('#FFFDF8', 0.14) : withAlpha(cardBorder, 0.68),
                maxWidth: 'min(90%, 44rem)',
              }}
            >
              <p
                style={{
                  fontSize: 'clamp(13px, 1.28vw, 18px)',
                  lineHeight: 1.58,
                  color: leadTextMuted,
                  ...FOUR_LINE_CLAMP,
                }}
              >
                {event.description}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const EventsSlide = memo(function EventsSlide({ settings, media }: EventsSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const { containerRef, profile } = useDisplayViewportProfile<HTMLDivElement>();

  const accentGold = theme.accentGold || theme.accent || '#A68A64';
  const accentGreen = theme.accentGreen || theme.timeColBg || '#8F9779';
  const textMain = theme.textMain || theme.fg || '#3E2723';
  const textMuted = theme.textMuted || withAlpha(textMain, 0.72);
  const cardBg = theme.cardBg || theme.cellBg || '#FFFFFF';
  const cardBorder = theme.cardBorder || theme.gridTable || '#EBE5D3';
  const statusLive = theme.statusLive || '#10B981';
  const statusSoon = theme.statusPrestart || '#F59E0B';
  const statusNext = theme.statusNext || accentGold;

  const allEvents = buildEventPresentationData(settings, media, new Date(), {
    accentGold,
    accentGreen,
    statusLive,
    statusSoon,
    statusNext,
  });

  const layout = buildEventsSlideLayout(profile);
  const events = allEvents.slice(0, layout.maxEvents);
  const leadEvent = events[0];
  const secondaryEvents = events.slice(1);

  const showLeadDescription = Boolean(leadEvent?.description) && layout.showLeadDescriptionSpace;
  const showSecondaryImages = layout.showSecondaryImages;
  const showSecondaryDescriptions = layout.showSecondaryDescriptions;
  const secondaryImagePlacement = layout.secondaryImagePlacement;

  if (events.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden" style={{ padding: 'clamp(12px, 2.4%, 28px)' }}>
        <div
          className="flex h-full flex-col justify-between rounded-[1.95rem] border"
          style={{
            padding: 'clamp(16px, 2.6%, 28px)',
            background: [
              `radial-gradient(circle at 14% 18%, ${withAlpha(accentGold, 0.16)} 0%, transparent 32%)`,
              `radial-gradient(circle at 100% 0%, ${withAlpha(accentGreen, 0.14)} 0%, transparent 35%)`,
              `linear-gradient(155deg, ${withAlpha(cardBg, 0.98)} 0%, ${withAlpha(cardBg, 0.92)} 100%)`,
            ].join(','),
            borderColor: withAlpha(cardBorder, 0.72),
          }}
        >
          <div
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 font-black uppercase"
            style={{
              fontSize: 'clamp(8px, 0.9vw, 11px)',
              letterSpacing: '0.22em',
              color: accentGold,
              backgroundColor: withAlpha(cardBg, 0.86),
              borderColor: withAlpha(cardBorder, 0.72),
            }}
          >
            <Calendar style={{ width: '13px', height: '13px' }} />
            Events
          </div>

          <div className="max-w-[42rem]">
            <div className="font-black uppercase tracking-[0.22em]" style={{ fontSize: 'clamp(10px, 1vw, 14px)', color: accentGreen }}>
              Aktuell ruhig
            </div>
            <div className="mt-3 font-black uppercase leading-[0.96]" style={{ fontSize: 'clamp(24px, 3.2vw, 44px)', color: textMain }}>
              Keine Events geplant
            </div>
            <p className="mt-4" style={{ fontSize: 'clamp(13px, 1.25vw, 18px)', lineHeight: 1.55, color: textMuted }}>
              Sobald neue Termine angelegt und aktiviert sind, werden sie hier automatisch großflächig und informativ angezeigt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (layout.isCompact && leadEvent) {
    return (
      <div ref={containerRef} className="h-full w-full overflow-hidden" style={{ padding: '8px 12px' }}>
        <div className="grid h-full min-h-0 gap-2" style={{ gridTemplateRows: secondaryEvents[0] ? 'minmax(0, 1.15fr) minmax(0, 0.85fr)' : '1fr' }}>
          <LeadEventCard
            event={leadEvent}
            textMain={textMain}
            textMuted={textMuted}
            cardBg={cardBg}
            cardBorder={cardBorder}
            accentGold={accentGold}
            accentGreen={accentGreen}
            showDescription={Boolean(leadEvent.description) && profile.height >= 210}
          />

          {secondaryEvents[0] ? (
            <SecondaryEventCard
              event={secondaryEvents[0]}
              accentGreen={accentGreen}
              textMain={textMain}
              textMuted={textMuted}
              cardBg={cardBg}
              cardBorder={cardBorder}
              showImage={false}
              showDescription={Boolean(secondaryEvents[0].description)}
              imagePlacement="top"
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden" style={{ padding: 'clamp(12px, 2.4%, 28px)' }}>
      <div
        className="grid h-full min-h-0"
        style={{
          gap: layout.isVertical ? 'clamp(10px, 1.8%, 18px)' : 'clamp(12px, 2%, 22px)',
          gridTemplateRows: secondaryEvents.length > 0
            ? (layout.isVertical ? 'minmax(0, 1.08fr) minmax(0, 0.92fr)' : 'minmax(0, 1.02fr) minmax(0, 0.98fr)')
            : '1fr',
        }}
      >
        <LeadEventCard
          event={leadEvent}
          textMain={textMain}
          textMuted={textMuted}
          cardBg={cardBg}
          cardBorder={cardBorder}
          accentGold={accentGold}
          accentGreen={accentGreen}
          showDescription={showLeadDescription}
        />

        {secondaryEvents.length > 0 ? (
          <div
            className="grid min-h-0 auto-rows-fr"
            style={{
              gap: 'clamp(10px, 1.7%, 16px)',
              gridTemplateColumns: '1fr',
            }}
          >
            {secondaryEvents.map((event) => (
              <SecondaryEventCard
                key={event.id}
                event={event}
                accentGreen={accentGreen}
                textMain={textMain}
                textMuted={textMuted}
                cardBg={cardBg}
                cardBorder={cardBorder}
                showImage={showSecondaryImages}
                showDescription={showSecondaryDescriptions}
                imagePlacement={secondaryImagePlacement}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
