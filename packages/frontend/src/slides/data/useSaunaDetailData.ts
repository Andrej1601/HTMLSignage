import { useMemo } from 'react';
import type {
  SaunaDetailData,
  SaunaDetailStyle,
  SaunaInfusionEntry,
} from '@htmlsignage/design-sdk';
import type { Schedule } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getInfusionStatus } from '@/components/Display/wellnessDisplayUtils';
import {
  buildScheduleSaunaIndexMap,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from '@/components/Display/displayScheduleUtils';
import { getMediaUploadUrl } from '@/utils/mediaUrl';
import {
  buildAromas,
  clampIntensity,
  deriveInfoBadges,
  readPrestartMinutes,
  resolveSauna,
} from './shared';

export interface UseSaunaDetailDataInput {
  settings: Settings;
  schedule: Schedule;
  /** Sauna id or name; falls back to an empty slide if unresolvable. */
  saunaId: string | undefined;
  media?: Media[];
  deviceId?: string;
  /** Current wall time — passed in so the consumer owns tick cadence. */
  now: Date;
}

/**
 * Headless data hook for a sauna-detail slide.
 *
 * Returns a fully resolved {@link SaunaDetailData} (or `null` if the sauna
 * cannot be resolved). Pure derivation — no network, no timers.
 *
 * Live/next/prestart/finished flags are computed against the `now` argument,
 * so the consumer controls how often they refresh. The core will drive this
 * from a shared display clock in Phase 2.
 */
export function useSaunaDetailData(input: UseSaunaDetailDataInput): SaunaDetailData | null {
  const { settings, schedule, saunaId, media, deviceId, now } = input;

  const sauna = useMemo(
    () => resolveSauna(settings.saunas, saunaId),
    [settings.saunas, saunaId],
  );

  const activePresetKey = useMemo(
    () => resolveLivePresetKey(schedule, settings, now, deviceId),
    [schedule, settings, now, deviceId],
  );

  const daySchedule = schedule.presets?.[activePresetKey];

  const scheduleIndexByKey = useMemo(
    () => buildScheduleSaunaIndexMap(daySchedule?.saunas || []),
    [daySchedule],
  );

  const prestartMin = useMemo(() => readPrestartMinutes(settings), [settings]);

  const imageUrl = useMemo(() => {
    if (!sauna?.imageId) return null;
    return getMediaUploadUrl(media, sauna.imageId) ?? null;
  }, [media, sauna]);

  const upcoming = useMemo<SaunaInfusionEntry[]>(() => {
    if (!sauna || !daySchedule?.rows || !daySchedule.saunas) return [];

    const saunaIndex = resolveScheduleSaunaIndex(
      daySchedule.saunas,
      sauna.name,
      scheduleIndexByKey,
    );
    if (saunaIndex < 0) return [];

    const raw = daySchedule.rows
      .map((row) => {
        const entry = row.entries?.[saunaIndex];
        if (!entry?.title) return null;
        const durationMin = entry.duration ?? 15;
        const status = getInfusionStatus(now, row.time, durationMin, prestartMin);
        const item: SaunaInfusionEntry = {
          id: `${activePresetKey}-${sauna.id}-${row.time}`,
          time: row.time,
          durationMin,
          title: entry.title,
          description: entry.description || entry.subtitle || '',
          intensity: clampIntensity(entry.flames ?? 1),
          aromas: buildAromas(entry.badges, settings.aromas),
          isLive: status === 'ONGOING',
          isPrestart: status === 'PRESTART',
          isFinished: status === 'FINISHED',
          // `isNext` is assigned in a second pass (see below).
          isNext: false,
        };
        return item;
      })
      .filter((item): item is SaunaInfusionEntry => item !== null)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    // Mark the earliest upcoming-but-not-yet-live entry as "next".
    const nextIdx = raw.findIndex((entry) => !entry.isLive && !entry.isFinished);
    if (nextIdx >= 0) {
      raw[nextIdx] = { ...raw[nextIdx], isNext: true };
    }
    return raw;
  }, [
    sauna,
    daySchedule,
    scheduleIndexByKey,
    now,
    prestartMin,
    activePresetKey,
    settings.aromas,
  ]);

  const styleHint: SaunaDetailStyle = useMemo(
    () => normaliseSaunaDetailStyle(settings.saunaDetailStyle),
    [settings.saunaDetailStyle],
  );

  return useMemo<SaunaDetailData | null>(() => {
    if (!sauna) return null;
    return {
      saunaId: sauna.id,
      name: sauna.name,
      subtitle: undefined,
      description: sauna.description || undefined,
      infoBadges: deriveInfoBadges(sauna.description),
      accentColor: sauna.color || undefined,
      imageUrl,
      info: {
        temperatureC: sauna.info?.temperature,
        humidityPct: sauna.info?.humidity,
        capacity: sauna.info?.capacity,
        features: sauna.info?.features,
      },
      upcoming,
      styleHint,
    };
  }, [sauna, imageUrl, upcoming, styleHint]);
}

/**
 * Accept the host's `settings.saunaDetailStyle` and clamp it to a value
 * the SDK understands. Unknown / missing values fall back to `split`,
 * which is guaranteed to be implemented by every pack.
 */
function normaliseSaunaDetailStyle(value: unknown): SaunaDetailStyle {
  if (value === 'hero' || value === 'portrait' || value === 'split') return value;
  return 'split';
}
