import type { EventStatusRank, SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

type Tokens = SlideRendererProps<'events'>['tokens'];
type Viewport = SlideRendererProps<'events'>['context']['viewport'];

/**
 * Aurora Thermal — events renderer.
 *
 * The events board reads like a brass hotel-lobby playbill: oversized
 * day-number in serif, month below in small-caps brass, title as the
 * hero line, time + location as italic eyebrow, status as brass chip.
 *
 * The event with an image flips to a photo-forward card — brass bar
 * down the left, polaroid frame around the photograph. It punctuates
 * the otherwise typographic rhythm.
 */
export function EventsSlideRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'events'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 14);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 8),
      }}
    >
      {/* Masthead — one line. Title + right-aligned count. The old
          two-line "Auf einen Blick / Events · Termine" kicker-stack
          ate vertical space that belongs to the list. */}
      <div
        className="flex items-baseline justify-between shrink-0"
        style={{ gap: scaled(16, viewport, 6), paddingBottom: scaled(2, viewport, 1) }}
      >
        <h1
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.1, viewport, 18)}px`,
            fontWeight: 500,
            letterSpacing: '-0.015em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          Termine
        </h1>
        <span
          className="tabular-nums shrink-0"
          style={{
            color: withAlpha(colors.textSecondary, 0.9),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            letterSpacing: '0.04em',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          {data.events.length} {data.events.length === 1 ? 'Termin' : 'Termine'}
        </span>
      </div>

      <div style={brassHairline(colors, 1)} />

      {data.events.length === 0 ? (
        <EmptyState tokens={tokens} viewport={viewport} />
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <div
            className="flex flex-col"
            style={{ paddingTop: scaled(10, viewport, 3), gap: scaled(spacing.sm, viewport, 4) }}
          >
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

function EmptyState({ tokens, viewport }: { tokens: Tokens; viewport: Viewport }) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center"
      style={{ gap: scaled(16, viewport, 6) }}
    >
      <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 48) }} />
      <span
        style={{
          color: withAlpha(colors.textSecondary, 0.9),
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
          fontStyle: 'italic',
          fontWeight: 400,
        }}
      >
        Aktuell sind keine Events geplant.
      </span>
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
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography, radius } = tokens;
  const status = eventStatus(event.statusRank, tokens);

  const start = new Date(event.startsAt);
  const hasStart = Number.isFinite(start.getTime());
  const dayLabel = hasStart ? start.getDate().toString().padStart(2, '0') : '—';
  const monthLabel = hasStart
    ? start.toLocaleDateString('de-DE', { month: 'long' })
    : '';
  const weekdayLabel = hasStart
    ? start.toLocaleDateString('de-DE', { weekday: 'long' })
    : '';

  // Image moved to the far right. Still hidden on truly narrow/compact
  // zones since a 130×84 thumbnail would push the title under 240px.
  const hasImage = Boolean(event.imageUrl) && !viewport.isNarrow && !viewport.isCompact;

  return (
    <div
      className="flex items-stretch"
      style={{
        borderTop: first ? `1px solid ${withAlpha(colors.border, 0.55)}` : 'none',
        borderBottom: `1px solid ${withAlpha(colors.border, 0.55)}`,
        padding: `${scaled(16, viewport, 7)}px 0`,
        gap: scaled(22, viewport, 8),
        position: 'relative',
      }}
    >
      {/* Left: brass rule + date stack + relative-label pill below.
          The standalone "Jetzt / Bald / Geplant" column is gone —
          the live beat is carried by the brass rule glowing ember,
          the relative-label ("In 4 Tagen", "Jetzt live") sits in
          a small pill directly under the weekday. */}
      <div
        className="shrink-0 flex"
        style={{
          gap: scaled(14, viewport, 5),
          minWidth: scaled(128, viewport, 82),
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            width: 2,
            backgroundColor: event.isLive
              ? colors.statusLive
              : withAlpha(colors.accentPrimary, 0.8),
            borderRadius: 1,
            boxShadow: event.isLive
              ? `0 0 14px ${withAlpha(colors.statusLive, 0.55)}`
              : 'none',
          }}
        />
        <div
          className="flex flex-col min-w-0"
          style={{ gap: scaled(4, viewport, 1), justifyContent: 'center' }}
        >
          <span
            className="tabular-nums"
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 0.9, viewport, 22)}px`,
              fontWeight: 400,
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
            }}
          >
            {dayLabel}
          </span>
          {monthLabel ? (
            <span
              style={kickerStyles(
                colors.accentPrimary,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.88, viewport, 8),
              )}
            >
              {monthLabel}
            </span>
          ) : null}
          {weekdayLabel ? (
            <span
              style={eyebrowStyles(
                withAlpha(colors.textSecondary, 0.88),
                scaledFont(typography.baseSizePx * typography.scaleBase * 0.88, viewport, 9),
                typography.fontHeading,
              )}
            >
              {weekdayLabel}
            </span>
          ) : null}
          {event.relativeLabel ? (
            <span
              className="inline-flex items-center"
              style={{
                alignSelf: 'flex-start',
                marginTop: scaled(4, viewport, 1),
                gap: scaled(6, viewport, 2),
                padding: `${scaled(3, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
                borderRadius: 9999,
                border: `1px solid ${withAlpha(status.color, event.isLive ? 0.75 : 0.5)}`,
                backgroundColor: withAlpha(status.color, event.isLive ? 0.2 : 0.1),
                color: status.color,
                fontFamily: typography.fontBody,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9)}px`,
                fontWeight: 600,
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                boxShadow: event.isLive
                  ? `0 0 12px ${withAlpha(status.color, 0.45)}`
                  : 'none',
              }}
            >
              {event.isLive ? (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: status.color,
                    boxShadow: `0 0 10px ${withAlpha(status.color, 0.95)}`,
                  }}
                />
              ) : null}
              {event.relativeLabel}
            </span>
          ) : null}
        </div>
      </div>

      {/* Middle: title + meta — flex-1 absorbs most of the horizontal
          budget now that the status column is gone. */}
      <div
        className="flex flex-1 min-w-0 flex-col"
        style={{ gap: scaled(6, viewport, 2), justifyContent: 'center' }}
      >
        <h3
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.1, viewport, 18)}px`,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: viewport.isNarrow ? 2 : 3,
          }}
          title={event.title}
        >
          {event.title}
        </h3>
        <div
          className="flex items-baseline flex-wrap"
          style={{ gap: `${scaled(4, viewport, 1)}px ${scaled(12, viewport, 4)}px` }}
        >
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textPrimary, 0.9),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
              fontWeight: 500,
              letterSpacing: '0.03em',
            }}
          >
            {event.timeLabel}
          </span>
          {event.location ? (
            <span
              style={eyebrowStyles(
                withAlpha(colors.textPrimary, 0.82),
                scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11),
                typography.fontHeading,
              )}
            >
              · {event.location}
            </span>
          ) : null}
        </div>
        {event.description ? (
          <p
            style={{
              color: withAlpha(colors.textPrimary, 0.85),
              fontFamily: typography.fontBody,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
              lineHeight: 1.45,
              fontWeight: 400,
              margin: 0,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: viewport.isCompact ? 1 : viewport.isNarrow ? 2 : 3,
            }}
          >
            {event.description}
          </p>
        ) : null}
      </div>

      {/* Right: only the image. No status column. */}
      {hasImage ? (
        <div
          className="shrink-0"
          style={{
            width: scaled(150, viewport, 72),
            height: scaled(100, viewport, 54),
            borderRadius: radius.md,
            overflow: 'hidden',
            border: `1px solid ${withAlpha(colors.accentPrimary, 0.35)}`,
            boxShadow: `0 14px 34px ${withAlpha(colors.surface, 0.5)}, inset 0 0 0 1px ${withAlpha(colors.accentPrimary, 0.14)}`,
            position: 'relative',
            alignSelf: 'center',
          }}
        >
          <img
            src={event.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.05) brightness(0.95)' }}
          />
        </div>
      ) : null}
    </div>
  );
}

function eventStatus(
  rank: EventStatusRank,
  tokens: Tokens,
): { color: string; label: string } {
  const { colors } = tokens;
  switch (rank) {
    case 'live':
      return { color: colors.statusLive, label: 'Jetzt' };
    case 'soon':
      return { color: colors.statusWarning, label: 'Bald' };
    case 'near':
      return { color: colors.statusNext, label: 'Diese Woche' };
    case 'far':
    default:
      return { color: withAlpha(colors.textSecondary, 0.8), label: 'Geplant' };
  }
}
