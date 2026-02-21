/**
 * Shared date/time utility functions.
 */

/** Returns the number of minutes elapsed since the given ISO timestamp, or null if invalid/missing. */
export function getMinutesSince(lastSeen?: string): number | null {
  if (!lastSeen) return null;
  const time = new Date(lastSeen).getTime();
  if (!Number.isFinite(time)) return null;
  return (Date.now() - time) / (1000 * 60);
}

/** Formats a Date as a human-readable relative time string (German). */
export function formatRelativeTime(date?: Date | null): string {
  if (!date) return 'Unbekannt';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'gerade eben';
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  const diffDays = Math.floor(diffHours / 24);
  return `vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`;
}

/** Safely converts a string or Date to a valid Date, returning undefined if invalid. */
export function toValidDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}
