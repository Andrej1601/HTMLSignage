import { normalizeSaunaNameKey } from '@/types/schedule.types';
import type { Sauna } from '@/types/sauna.types';

const ACCENT_FALLBACKS = ['#F59E0B', '#10B981', '#c5a059', '#8B6F47'];

export function timeToMinutes(timeStr: string): number {
  const [hRaw, mRaw] = String(timeStr ?? '').split(':');
  const hours = parseInt(hRaw || '', 10);
  const minutes = parseInt(mRaw || '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + minutes;
}

export function buildScheduleSaunaIndexMap(saunas: string[] = []): Map<string, number> {
  const map = new Map<string, number>();
  saunas.forEach((name, index) => {
    const key = normalizeSaunaNameKey(name);
    if (key && !map.has(key)) {
      map.set(key, index);
    }
  });
  return map;
}

export function resolveScheduleSaunaIndex(
  scheduleSaunas: string[] = [],
  saunaName: string,
  saunaIndexByKey?: Map<string, number>,
): number {
  const exactIndex = scheduleSaunas.indexOf(saunaName);
  if (exactIndex >= 0) {
    return exactIndex;
  }
  if (!saunaIndexByKey) {
    return -1;
  }
  return saunaIndexByKey.get(normalizeSaunaNameKey(saunaName)) ?? -1;
}

export function getSaunaAccentColor(
  sauna: Pick<Sauna, 'color'>,
  index: number,
  accentGreen: string,
  accentGold: string,
): string {
  if (sauna.color && typeof sauna.color === 'string') {
    return sauna.color;
  }
  const fallbackPalette = [accentGold, accentGreen, ...ACCENT_FALLBACKS];
  return fallbackPalette[index % fallbackPalette.length];
}
