/**
 * In-memory cache for the active global schedule and settings.
 *
 * Every device polling /display-config fetches both the active schedule and the
 * active settings from Postgres.  With many devices this creates dozens of
 * identical DB reads per second even though the data changes rarely.
 *
 * The cache keeps the last result for CACHE_TTL_MS (default 5 s).  It is
 * explicitly invalidated whenever a new settings or schedule version is saved so
 * the next request always picks up the freshest data.
 */

import { prisma } from './prisma.js';

interface GlobalConfigCacheEntry {
  scheduleData: unknown;
  settingsData: unknown;
  cachedAt: number;
}

const CACHE_TTL_MS = 5_000;

let _cache: GlobalConfigCacheEntry | null = null;

/** Call this after saving a new settings or schedule version. */
export function invalidateGlobalConfigCache(): void {
  _cache = null;
}

/** Returns cached active schedule + settings, refreshing if stale or missing. */
export async function getCachedGlobalConfig(): Promise<{
  scheduleData: unknown;
  settingsData: unknown;
}> {
  const now = Date.now();

  if (_cache && now - _cache.cachedAt < CACHE_TTL_MS) {
    return _cache;
  }

  const [activeSchedule, activeSettings] = await Promise.all([
    prisma.schedule.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    }),
    prisma.settings.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    }),
  ]);

  _cache = {
    scheduleData: activeSchedule?.data ?? null,
    settingsData: activeSettings?.data ?? null,
    cachedAt: now,
  };

  return _cache;
}
