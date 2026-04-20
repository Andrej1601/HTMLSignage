import type { EventStatusRank, SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  statusChipStyles,
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
      {/* Masthead */}
      <div
        className="flex items-end justify-between shrink-0"
        style={{ paddingBottom: scaled(6, viewport, 2) }}
      >
        <div className="flex flex-col" style={{ gap: scaled(8, viewport, 3) }}>
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
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 20)}px`,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 0.95,
              margin: 0,
            }}
          >
            Events · Termine
          </h1>
        </div>
        <span
          className="tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
            letterSpacing: '0.04em',
            fontWeight: 500,
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

  // Image is expensive on horizontal budget — show it only when the
  // row is genuinely wide. A 150px thumbnail + gap + status column
  // would push the title area under 300px on a typical 960px zone,
  // which is the complaint we're fixing here.
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
      {/* Left: brass-accent rule + day block — compacted so the title
          wins real estate on medium-width zones. */}
      <div
        className="shrink-0 flex"
        style={{
          gap: scaled(14, viewport, 5),
          minWidth: scaled(116, viewport, 74),
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
          className="flex flex-col"
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
        </div>
      </div>

      {/* Middle: title + meta — flex-1 so it absorbs all slack space.
          Title gets up to 3 lines when space allows; on narrow zones
          we drop to 2 to protect the date column. */}
      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(6, viewport, 2), justifyContent: 'center' }}>
        <h3
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.05, viewport, 16)}px`,
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

      {/* Right: image + status. Image is dropped on non-wide zones so
          the middle column gets the full slack. Status column is also
          slimmer than before — "Jetzt / Bald / Geplant" fits in ~86px. */}
      <div
        className="shrink-0 flex items-center"
        style={{ gap: scaled(14, viewport, 5) }}
      >
        {hasImage ? (
          <div
            style={{
              width: scaled(130, viewport, 64),
              height: scaled(84, viewport, 46),
              borderRadius: radius.md,
              overflow: 'hidden',
              border: `1px solid ${withAlpha(colors.accentPrimary, 0.35)}`,
              boxShadow: `0 14px 34px ${withAlpha(colors.surface, 0.5)}, inset 0 0 0 1px ${withAlpha(colors.accentPrimary, 0.14)}`,
              position: 'relative',
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

        <div
          className="flex flex-col items-end"
          style={{ gap: scaled(6, viewport, 2), minWidth: scaled(92, viewport, 54) }}
        >
          <span
            style={statusChipStyles(status.color, {
              isLive: event.isLive,
              sizePx: scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8),
              fontFamily: typography.fontBody,
            })}
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
            {status.label}
          </span>
          {event.relativeLabel ? (
            <span
              className="truncate"
              style={{
                ...eyebrowStyles(
                  withAlpha(colors.textSecondary, 0.85),
                  scaledFont(typography.baseSizePx * typography.scaleBase * 0.88, viewport, 9),
                  typography.fontHeading,
                ),
                textAlign: 'right',
                maxWidth: scaled(120, viewport, 72),
              }}
            >
              {event.relativeLabel}
            </span>
          ) : null}
        </div>
      </div>
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
