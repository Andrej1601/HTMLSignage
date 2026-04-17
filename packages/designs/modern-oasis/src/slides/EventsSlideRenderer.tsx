import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Modern Oasis — events slide renderer.
 *
 * TODO: Render up to four events from {@link data.events}. Use
 * `entry.statusRank` ('live' | 'soon' | 'near' | 'far') to derive
 * styling from {@link tokens.colors.statusLive} / statusWarning / etc.
 * Labels (dateLabel, timeLabel, relativeLabel) are already formatted
 * in the locale from `context.locale`.
 */
export function EventsSlideRenderer({ data, tokens }: SlideRendererProps<'events'>) {
  const { colors, typography, spacing } = tokens;
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${spacing.xl}px`,
        gap: `${spacing.md}px`,
      }}
    >
      {data.events.length === 0 ? (
        <p style={{ color: colors.textSecondary }}>Keine Veranstaltungen geplant.</p>
      ) : (
        data.events.map((event) => (
          <div
            key={event.id}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              padding: `${spacing.md}px`,
            }}
          >
            <div style={{ color: colors.textSecondary, fontSize: `${typography.baseSizePx * typography.scaleSm}px` }}>
              {event.relativeLabel} · {event.dateLabel} {event.timeLabel}
            </div>
            <div
              className="font-black"
              style={{ fontSize: `${typography.baseSizePx * typography.scaleLg}px` }}
            >
              {event.title}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
