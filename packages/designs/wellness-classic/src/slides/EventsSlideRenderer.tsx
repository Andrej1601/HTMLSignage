import type {
  EventSlideEntry,
  EventStatusRank,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';

function badgeColorFor(rank: EventStatusRank, tokens: SlideRendererProps<'events'>['tokens']): string {
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
}

function EventCard({ entry, tokens, size }: EventCardProps) {
  const { colors, typography, spacing, radius } = tokens;
  const isLead = size === 'lead';
  const badgeBg = badgeColorFor(entry.statusRank, tokens);

  return (
    <article
      className="flex h-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: `${radius.lg}px`,
        border: `1px solid ${colors.border}`,
        padding: `${spacing.lg}px`,
        gap: `${spacing.md}px`,
      }}
    >
      {entry.imageUrl ? (
        <div
          className="w-full overflow-hidden"
          style={{
            aspectRatio: isLead ? '16 / 9' : '3 / 2',
            borderRadius: `${radius.md}px`,
          }}
        >
          <img
            src={entry.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="flex items-center" style={{ gap: `${spacing.sm}px` }}>
        <span
          className="font-black uppercase"
          style={{
            backgroundColor: badgeBg,
            color: colors.textInverse,
            fontFamily: typography.fontBody,
            fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
            letterSpacing: '0.18em',
            padding: `${spacing.xs}px ${spacing.sm}px`,
            borderRadius: `${radius.pill}px`,
          }}
        >
          {entry.relativeLabel}
        </span>
        <span
          className="font-medium"
          style={{
            color: colors.textSecondary,
            fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
          }}
        >
          {entry.dateLabel} · {entry.timeLabel}
        </span>
      </div>

      <h3
        className="font-black"
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${typography.baseSizePx * (isLead ? typography.scale2xl : typography.scaleLg)}px`,
          lineHeight: 1.15,
        }}
      >
        {entry.title}
      </h3>

      {entry.description ? (
        <p
          style={{
            color: colors.textSecondary,
            fontSize: `${typography.baseSizePx * typography.scaleBase}px`,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: isLead ? 4 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {entry.description}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Wellness Classic — events slide renderer.
 *
 * Lead event gets the prominent card; up to three additional events
 * occupy a secondary column. Status-rank drives badge colour via
 * tokens — no per-event visual decisions in the data.
 */
export function EventsSlideRenderer({ data, tokens }: SlideRendererProps<'events'>) {
  const { colors, typography, spacing } = tokens;

  if (data.events.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
        }}
      >
        Aktuell sind keine Veranstaltungen geplant.
      </div>
    );
  }

  const [lead, ...rest] = data.events;
  const secondary = rest.slice(0, 3);

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        padding: `${spacing.lg}px`,
        gap: `${spacing.lg}px`,
        gridTemplateColumns: secondary.length > 0 ? 'minmax(0, 1.35fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
      }}
    >
      <EventCard entry={lead} tokens={tokens} size="lead" />
      {secondary.length > 0 ? (
        <div className="grid" style={{ gap: `${spacing.md}px`, gridAutoRows: '1fr' }}>
          {secondary.map((entry) => (
            <EventCard key={entry.id} entry={entry} tokens={tokens} size="secondary" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
