import type { Aroma, Event, Settings, ThemeColors } from '@/types/settings.types';

export type InfusionStatus = 'ONGOING' | 'PRESTART' | 'UPCOMING' | 'FINISHED';

export function clampFlamesTo4(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(4, Math.max(1, n));
}

export function getInfusionStatus(
  now: Date,
  timeStr: string,
  durationMin: number,
  prestartMin: number = 10,
): InfusionStatus {
  const [hours, minutes] = timeStr.split(':').map((v) => parseInt(v, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 'UPCOMING';

  const startTime = new Date(now);
  startTime.setHours(hours, minutes, 0, 0);

  const preStartTime = new Date(startTime);
  preStartTime.setMinutes(preStartTime.getMinutes() - prestartMin);

  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + (durationMin || 0));

  if (now >= startTime && now < endTime) return 'ONGOING';
  if (now >= preStartTime && now < startTime) return 'PRESTART';
  if (now < preStartTime) return 'UPCOMING';
  return 'FINISHED';
}

export function formatLongDateDE(now: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now);
}

export function formatClockDE(now: Date): string {
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getScentEmoji(label: string, aromas?: Aroma[]): string {
  const norm = normalizeLabel(label || '');

  if (aromas && aromas.length > 0) {
    for (const aroma of aromas) {
      const aNorm = normalizeLabel(aroma.name || '');
      if (aNorm && (norm === aNorm || norm.includes(aNorm))) {
        return aroma.emoji;
      }
    }
  }

  if (norm.includes('birke')) return '🌿';
  if (norm.includes('eukalyptus')) return '🍃';
  if (norm.includes('menthol')) return '❄️';
  if (norm.includes('eisminze') || norm.includes('minze')) return '🧊';
  if (norm.includes('meersalz') || norm.includes('salz')) return '🌊';
  if (norm.includes('zitrone') || norm.includes('limette') || norm.includes('citrus')) return '🍋';
  if (norm.includes('zirbe') || norm.includes('fichte') || norm.includes('kiefer') || norm.includes('tanne')) return '🌲';
  if (norm.includes('lavendel')) return '💜';
  if (norm.includes('rose')) return '🌹';
  if (norm.includes('kräuter') || norm.includes('kraeuter')) return '⛰️';
  return '🧴';
}

export function resolveTheme(settings: Settings, fallback: Settings): ThemeColors {
  return (settings.theme || fallback.theme) as ThemeColors;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = String(hex || '').trim().replace(/^#/, '');
  if (!raw) return null;

  const normalized = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;

  if (normalized.length !== 6 || /[^0-9a-fA-F]/.test(normalized)) return null;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

/**
 * Converts a hex color (#RGB/#RRGGBB) to rgba() with the given alpha.
 * Falls back to the input string for unsupported formats.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = clamp01(alpha);
  const c = String(color || '').trim();

  if (!c) return `rgba(0,0,0,${a})`;

  if (c.startsWith('#')) {
    const rgb = hexToRgb(c);
    if (!rgb) return c;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
  }

  // Best-effort handling for rgb()/rgba()
  if (c.startsWith('rgba(')) {
    return c.replace(/^rgba\(([^)]+)\)$/i, (_m, inner) => {
      const parts = String(inner).split(',').map((p) => p.trim());
      if (parts.length < 3) return c;
      const [r, g, b] = parts;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    });
  }
  if (c.startsWith('rgb(')) {
    return c.replace(/^rgb\(([^)]+)\)$/i, (_m, inner) => `rgba(${inner}, ${a})`);
  }

  return c;
}

export function getUpcomingOrActiveEvents(settings: Settings, now: Date): Event[] {
  const events = settings.events || [];
  const candidates = events.filter((e) => e.isActive);

  const withTimes = candidates
    .map((event) => {
      const start = new Date(`${event.startDate}T${event.startTime}`);
      const endDate = event.endDate || event.startDate;
      const endTime = event.endTime || '23:59';
      const end = new Date(`${endDate}T${endTime}`);
      return { event, start, end };
    })
    .filter(({ start, end }) => Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()))
    .filter(({ start, end }) => now <= end || now <= start) // active (now<=end) or upcoming (now<=start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return withTimes.map((x) => x.event).slice(0, 2);
}

export function formatEventDateDE(event: Event): string {
  const start = new Date(`${event.startDate}T${event.startTime}`);
  if (!Number.isFinite(start.getTime())) return event.startDate;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  }).format(start);
}

export function formatEventTimeRangeDE(event: Event): string {
  const startTime = event.startTime;
  const endTime = event.endTime;
  const endDate = event.endDate;

  if (endTime && (!endDate || endDate === event.startDate)) {
    return `${startTime} - ${endTime}`;
  }
  return `ab ${startTime}`;
}
