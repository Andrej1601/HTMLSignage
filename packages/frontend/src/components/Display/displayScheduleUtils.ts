import { normalizeSaunaNameKey } from '@/types/schedule.types';

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

