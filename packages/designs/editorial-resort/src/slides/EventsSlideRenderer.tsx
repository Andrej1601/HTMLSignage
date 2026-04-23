import type { EventStatusRank, SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Editorial Resort — events renderer.
 *
 * Magazine calendar: big serif dates, editorial titles, italic location
 * line, status as a small italic descriptor rather than a coloured pill.
 */
export function EventsSlideRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'events'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 6),
      }}
    >
      {/* Masthead */}
      <div
        className="flex items-end justify-between shrink-0"
        style={{
          paddingBottom: scaled(16, viewport, 6),
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
          <span
            style={kickerStyles(
              colors.accentPrimary,
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
            )}
          >
            Auf einen Blick
          </span>
          <h1
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 18)}px`,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Events
          </h1>
        </div>
        <span
          className="tabular-nums"
          style={eyebrowStyles(
            withAlpha(colors.textSecondary, 0.85),
            scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10),
            typography.fontHeading,
          )}
        >
          {data.events.length} {data.events.length === 1 ? 'Termin' : 'Termine'}
        </span>
      </div>

      {data.events.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontHeading,
            fontStyle: 'italic',
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
          }}
        >
          Keine Events geplant.
        </div>
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <div className="flex flex-col">
            {data.events.map((event, idx) => (
              <EventRow
                key={event.id}
                event={event}
                first={idx === 0}
                tokens={tokens}
                viewport={viewport}
              />
            ))}
          </div>
        </AutoScroll>
      )}
    </div>
  );
}

function EventRow({
  event,
  first,
  tokens,
  viewport,
}: {
  event: SlideRendererProps<'events'>['data']['events'][number];
  first: boolean;
  tokens: SlideRendererProps<'events'>['tokens'];
  viewport: SlideRendererProps<'events'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const status = eventStatus(event.statusRank, tokens);

  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const dayLabel = Number.isFinite(start.getTime()) ? start.getDate().toString().padStart(2, '0') : '—';
  const monthLabel = Number.isFinite(start.getTime())
    ? start.toLocaleDateString('de-DE', { month: 'long' })
    : '';
  const weekdayLabel = Number.isFinite(start.getTime())
    ? start.toLocaleDateString('de-DE', { weekday: 'long' })
    : '';
  const timeLabel = Number.isFinite(start.getTime())
    ? `${fmtTime(start)}${Number.isFinite(end.getTime()) ? ' – ' + fmtTime(end) : ''}`
    : '';

  // Image replaces the old "geplant" right column. Hidden on truly
  // narrow/compact zones so the title always keeps its room.
  const hasImage = Boolean(event.imageUrl) && !viewport.isNarrow && !viewport.isCompact;

  return (
    <div
      className="flex items-stretch"
      style={{
        borderTop: first ? `1px solid ${colors.border}` : 'none',
        borderBottom: `1px solid ${colors.border}`,
        padding: `${scaled(20, viewport, 8)}px 0`,
        gap: scaled(28, viewport, 10),
      }}
    >
      {/* Large serif date block — the brass rule on the left glows
          `status.color` (ember for live, warm-brass for "geplant",
          etc.) so the status beat is still carried without the
          standalone right-column label. */}
      <div
        className="shrink-0 flex items-stretch"
        style={{ gap: scaled(14, viewport, 5), minWidth: scaled(130, viewport, 74) }}
      >
        <div
          style={{
            width: 2,
            borderRadius: 1,
            backgroundColor: event.isLive
              ? status.color
              : withAlpha(status.color, 0.7),
            boxShadow: event.isLive
              ? `0 0 12px ${withAlpha(status.color, 0.5)}`
              : 'none',
          }}
        />
        <div className="flex flex-col items-baseline" style={{ gap: scaled(6, viewport, 2), justifyContent: 'center' }}>
          <span
            className="tabular-nums"
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 22)}px`,
              fontWeight: 500,
              lineHeight: 0.9,
              letterSpacing: '-0.015em',
            }}
          >
            {dayLabel}
          </span>
          {monthLabel ? (
            <span
              style={kickerStyles(
                withAlpha(colors.textSecondary, 0.9),
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8),
              )}
            >
              {monthLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Title + meta column — flex-1 absorbs all slack. */}
      <div
        className="flex flex-1 min-w-0 flex-col justify-center"
        style={{ gap: scaled(6, viewport, 2) }}
      >
        {weekdayLabel ? (
          <span
            style={kickerStyles(
              colors.accentPrimary,
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
            )}
          >
            {weekdayLabel}
          </span>
        ) : null}
        <h3
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            margin: 0,
            overflowWrap: 'anywhere',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: viewport.isCompact ? 2 : 3,
          }}
          title={event.title}
        >
          {event.title}
        </h3>
        <span
          className="truncate"
          style={eyebrowStyles(
            withAlpha(colors.textSecondary, 0.95),
            scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11),
            typography.fontHeading,
          )}
        >
          {timeLabel}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </div>

      {/* Event image — takes the spot where "geplant" used to sit.
          Served from the event.imageUrl; hidden only on narrow /
          compact zones where its 150×100 thumbnail would push the
          title under 240px. */}
      {hasImage ? (
        <div
          className="shrink-0 self-center"
          style={{
            width: scaled(150, viewport, 72),
            height: scaled(100, viewport, 54),
            borderRadius: radius.md,
            overflow: 'hidden',
            border: `1px solid ${withAlpha(colors.accentPrimary, 0.35)}`,
            boxShadow: `0 10px 28px ${withAlpha(colors.textPrimary, 0.12)}`,
            position: 'relative',
          }}
        >
          <img
            src={event.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.98) brightness(0.97)' }}
          />
        </div>
      ) : null}
    </div>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function eventStatus(
  rank: EventStatusRank,
  tokens: SlideRendererProps<'events'>['tokens'],
) {
  const { colors } = tokens;
  switch (rank) {
    case 'live':
      return { color: colors.statusLive, label: 'läuft jetzt' };
    case 'soon':
      return { color: colors.statusWarning, label: 'bald' };
    case 'near':
      return { color: colors.statusNext, label: 'diese Woche' };
    case 'far':
    default:
      return { color: withAlpha(colors.textSecondary, 0.8), label: 'geplant' };
  }
}
