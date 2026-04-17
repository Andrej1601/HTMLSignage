/**
 * Legacy-free helpers for event-related data transformations.
 *
 * The rich `buildEventPresentationData` / `buildEventsSlideLayout` and
 * the `EventPresentation` type were part of the pre-design-pack
 * pipeline; they are gone now. What remains is `formatRelativeEventBadgeLabel`,
 * which `useEventsPanelData` uses to produce locale-formatted labels.
 */

export function formatRelativeEventBadgeLabel(start: Date, end: Date, now: Date): string {
  if (now >= start && now <= end) {
    return 'Jetzt live';
  }

  const diffMinutes = Math.max(1, Math.round((start.getTime() - now.getTime()) / 60000));
  if (diffMinutes < 60) {
    return `In ${diffMinutes} Min.`;
  }

  const diffHours = Math.max(1, Math.round(diffMinutes / 60));
  if (diffHours < 48) {
    return `In ${diffHours} Std.`;
  }

  const diffDays = Math.max(1, Math.ceil(diffHours / 24));
  return diffDays === 1 ? 'In 1 Tag' : `In ${diffDays} Tagen`;
}
