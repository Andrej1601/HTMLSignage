/**
 * Format a timestamp as a short relative-time string ("vor 3 Min.", "vor 2 Tagen").
 * Locale-aware via `Intl.RelativeTimeFormat`. Future timestamps are
 * rendered with "in X Min." automatically.
 *
 * Bewusst kompakt — die Listen-Spalten haben oft wenig Platz. Für eine
 * vollständige Datumsangabe nutzen Konsumenten zusätzlich `title=` mit
 * `formatAbsoluteTime`.
 */
const DEFAULT_LOCALE = typeof navigator !== 'undefined' ? navigator.language || 'de-DE' : 'de-DE';

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

export function formatRelativeTime(input: string | Date | number, locale = DEFAULT_LOCALE): string {
  const date = input instanceof Date ? input : new Date(input);
  const ts = date.getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = ts - Date.now();
  const absDiff = Math.abs(diff);

  // Unter 30 Sekunden: "gerade eben"
  if (absDiff < 30_000) return diff < 0 ? 'gerade eben' : 'gleich';

  for (const { unit, ms } of UNITS) {
    if (absDiff >= ms) {
      const value = Math.round(diff / ms);
      try {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(
          value,
          unit,
        );
      } catch {
        return diff < 0 ? `vor ${Math.abs(value)} ${unit}` : `in ${value} ${unit}`;
      }
    }
  }

  // Fallback (unter 1 Minute, aber > 30s — durch Schwelle oben kaum erreicht)
  const seconds = Math.round(diff / 1000);
  return diff < 0 ? `vor ${Math.abs(seconds)} Sek.` : `in ${seconds} Sek.`;
}

/** Vollständige Datums+Zeit-Formatierung — als `title`-Tooltip neben dem
 *  Relative-Time gedacht. */
export function formatAbsoluteTime(input: string | Date | number, locale = DEFAULT_LOCALE): string {
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toISOString();
  }
}
