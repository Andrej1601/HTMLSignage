import type {
  EventSlideEntry,
  EventStatusRank,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { scaled, scaledFont } from './responsive';

function badgeColorFor(
  rank: EventStatusRank,
  tokens: SlideRendererProps<'events'>['tokens'],
): string {
  switch (rank) {
    case 'live':
      return tokens.colors.statusLive;
    case 'soon':
      return tokens.colors.statusWarning;
    case 'near':
      return tokens.colors.accentSecondary;
    case 'far':
    default:
      return tokens.colors.statusNext;
  }
}

interface EventCardProps {
  entry: EventSlideEntry;
  tokens: SlideRendererProps<'events'>['tokens'];
  size: 'lead' | 'secondary';
  viewport: SlideRendererProps<'events'>['context']['viewport'];
}

function EventCard({ entry, tokens, size, viewport }: EventCardProps) {
  const { colors, typography, radius } = tokens;
  const isLead = size === 'lead';
  const badgeBg = badgeColorFor(entry.statusRank, tokens);
  const titleScale = isLead ? typography.scale2xl : typography.scaleLg;

  return (
    <article
      className="flex h-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: `${scaled(24, viewport, 8)}px`,
        border: `1px solid ${colors.border}`,
        padding: `${scaled(20, viewport, 8)}px`,
        gap: `${scaled(12, viewport, 4)}px`,
      }}
    >
      {entry.imageUrl ? (
        <div
          className="w-full overflow-hidden shrink-0"
          style={{
            aspectRatio: isLead ? '16 / 9' : '3 / 2',
            borderRadius: `${scaled(12, viewport, 6)}px`,
          }}
        >
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div
        className="flex flex-wrap items-center shrink-0"
        style={{ gap: `${scaled(8, viewport, 3)}px` }}
      >
        <span
          className="font-black uppercase"
          style={{
            backgroundColor: badgeBg,
            color: colors.textInverse,
            fontFamily: typography.fontBody,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
            letterSpacing: '0.16em',
            padding: `${scaled(4, viewport, 2)}px ${scaled(8, viewport, 3)}px`,
            borderRadius: `${radius.pill}px`,
          }}
        >
          {entry.relativeLabel}
        </span>
        <span
          className="font-medium"
          style={{
            color: colors.textSecondary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
          }}
        >
          {entry.dateLabel} · {entry.timeLabel}
        </span>
      </div>

      <h3
        className="font-black shrink-0"
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * titleScale, viewport, 12)}px`,
          lineHeight: 1.15,
        }}
      >
        {entry.title}
      </h3>

      {entry.description ? (
        <AutoScroll className="flex-1 min-h-0">
          <p
            style={{
              color: colors.textSecondary,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {entry.description}
          </p>
        </AutoScroll>
      ) : null}
    </article>
  );
}

/**
 * Wellness List — events slide renderer.
 *
 * Structure is constant: lead card on the left, up to three secondary
 * cards on the right. Padding, radii, font sizes and gaps scale with
 * the viewport; long descriptions auto-scroll inside their card.
 */
export function EventsSlideRenderer({ data, tokens, context }: SlideRendererProps<'events'>) {
  const { colors, typography } = tokens;
  const { viewport } = context;

  if (data.events.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
        }}
      >
        Aktuell sind keine Veranstaltungen geplant.
      </div>
    );
  }

  const [lead, ...rest] = data.events;
  const secondary = rest.slice(0, 3);

  const pad = scaled(20, viewport, 6);
  const gap = scaled(20, viewport, 6);

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        padding: `${pad}px`,
        gap: `${gap}px`,
        gridTemplateColumns:
          secondary.length > 0 ? 'minmax(0, 1.35fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
      }}
    >
      <EventCard entry={lead} tokens={tokens} size="lead" viewport={viewport} />
      {secondary.length > 0 ? (
        <div
          className="grid min-h-0"
          style={{
            gap: `${scaled(12, viewport, 4)}px`,
            gridAutoRows: '1fr',
          }}
        >
          {secondary.map((entry) => (
            <EventCard
              key={entry.id}
              entry={entry}
              tokens={tokens}
              size="secondary"
              viewport={viewport}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
