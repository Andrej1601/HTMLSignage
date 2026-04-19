import type { EventStatusRank, SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — events renderer.
 *
 * Editorial event list. Left column holds the date in mono, centre
 * column the event title + location, right column a status rank label.
 * Rules between entries.
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
      <div className="flex items-baseline justify-between shrink-0">
        <span style={labelStyles(colors.accentPrimary, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
          Events
        </span>
        <span
          className="tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
            letterSpacing: '0.1em',
          }}
        >
          {data.events.length.toString().padStart(2, '0')} geplant
        </span>
      </div>

      {data.events.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Keine Events geplant
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
  const dateLabel = Number.isFinite(start.getTime())
    ? start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    : '';
  const weekdayLabel = Number.isFinite(start.getTime())
    ? start.toLocaleDateString('de-DE', { weekday: 'short' }).replace(/\.$/, '')
    : '';
  const timeLabel = Number.isFinite(start.getTime())
    ? `${fmt(start)}${Number.isFinite(end.getTime()) ? ` – ${fmt(end)}` : ''}`
    : '';

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${withAlpha(colors.border, 0.85)}` : 'none',
        borderBottom: `1px solid ${withAlpha(colors.border, 0.85)}`,
        padding: `${scaled(16, viewport, 6)}px 0`,
        gap: scaled(24, viewport, 8),
      }}
    >
      <div
        className="shrink-0 flex flex-col"
        style={{ minWidth: scaled(130, viewport, 80), gap: scaled(4, viewport, 1) }}
      >
        <span
          className="tabular-nums"
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
            lineHeight: 1,
            letterSpacing: '0.02em',
            fontWeight: 500,
          }}
        >
          {dateLabel}
        </span>
        {weekdayLabel ? (
          <span
            style={labelStyles(
              withAlpha(colors.textSecondary, 0.85),
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8),
            )}
          >
            {weekdayLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(4, viewport, 2) }}>
        <span
          className="truncate"
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
          title={event.title}
        >
          {event.title}
        </span>
        <span
          className="truncate"
          style={{
            color: withAlpha(colors.textSecondary, 0.95),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9)}px`,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {timeLabel}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </div>

      <span
        className="shrink-0"
        style={{
          color: status.color,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.8, viewport, 7)}px`,
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          fontWeight: 700,
          minWidth: scaled(80, viewport, 48),
          textAlign: 'right',
        }}
      >
        {status.label}
      </span>
    </div>
  );
}

function fmt(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function eventStatus(
  rank: EventStatusRank,
  tokens: SlideRendererProps<'events'>['tokens'],
) {
  const { colors } = tokens;
  switch (rank) {
    case 'live':
      return { color: colors.statusLive, label: 'Live' };
    case 'soon':
      return { color: colors.statusWarning, label: 'Bald' };
    case 'near':
      return { color: colors.statusNext, label: 'Diese Woche' };
    case 'far':
    default:
      return { color: withAlpha(colors.textSecondary, 0.8), label: 'Geplant' };
  }
}
