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
  const { colors, typography } = tokens;
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

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${colors.border}` : 'none',
        borderBottom: `1px solid ${colors.border}`,
        padding: `${scaled(20, viewport, 8)}px 0`,
        gap: scaled(28, viewport, 10),
      }}
    >
      {/* Large serif date block */}
      <div
        className="shrink-0 flex flex-col items-baseline"
        style={{ minWidth: scaled(130, viewport, 74), gap: scaled(6, viewport, 2) }}
      >
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

      {/* Title + meta column */}
      <div
        className="flex flex-1 min-w-0 flex-col"
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
          className="truncate"
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            margin: 0,
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

      {/* Status */}
      <div className="shrink-0" style={{ minWidth: scaled(100, viewport, 60), textAlign: 'right' }}>
        <span
          style={{
            color: status.color,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            fontStyle: 'italic',
            fontWeight: 400,
            letterSpacing: '0.03em',
          }}
        >
          {status.label}
        </span>
      </div>
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
