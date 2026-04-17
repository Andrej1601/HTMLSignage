import { useMemo } from 'react';
import type {
  SchedulePanelCell,
  SchedulePanelData,
} from '@htmlsignage/design-sdk';
import type { Schedule } from '@/types/schedule.types';
import { resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import { getVisibleSaunas } from '@/types/sauna.types';
import { getInfusionStatus } from '@/components/Display/wellnessDisplayUtils';
import {
  buildScheduleSaunaIndexMap,
  resolveScheduleSaunaIndex,
  timeToMinutes,
} from '@/components/Display/displayScheduleUtils';
import {
  buildAromas,
  clampIntensity,
  readPrestartMinutes,
} from './shared';

export interface UseSchedulePanelDataInput {
  settings: Settings;
  schedule: Schedule;
  deviceId?: string;
  now: Date;
  /**
   * Optional filter: restrict the output to this many saunas (defaults to the
   * first `limit` visible saunas; leave undefined for "all visible").
   */
  limit?: number;
}

/**
 * Enriched variant of {@link SchedulePanelCell} that also exposes the raw
 * entry inputs needed by legacy per-sauna renderers (time, duration,
 * intensity, description). Everything the SDK contract already promises
 * remains unchanged — extra fields are additive, not breaking.
 */
export interface SchedulePanelCellExtras extends SchedulePanelCell {
  time: string;
  durationMin: number;
  intensity: number;
  description?: string;
  isPrestart: boolean;
  isFinished: boolean;
}

/** Output shape. `saunasMeta` carries the original domain objects for styling. */
export interface SchedulePanelDataEnriched extends SchedulePanelData {
  cells: Array<Array<SchedulePanelCellExtras | null>>;
  saunasMeta: Sauna[];
}

/**
 * Headless data hook for a schedule / content-panel slide.
 *
 * Output:
 * - `saunas` / `saunasMeta` — visible saunas in display order.
 * - `timeSlots` — "HH:mm" time slots from the active preset.
 * - `cells[saunaIdx][slotIdx]` — resolved cell (with live/next flags) or `null`.
 *
 * The `saunasMeta` array carries the original `Sauna` objects so renderers
 * that style per-sauna (color, image) don't need to re-resolve them.
 *
 * The `isNext` flag is set for the earliest upcoming entry across the entire
 * panel (matches the dashboard's global "next up" semantics).
 */
export function useSchedulePanelData(input: UseSchedulePanelDataInput): SchedulePanelDataEnriched {
  const { settings, schedule, deviceId, now, limit } = input;

  const activePresetKey = useMemo(
    () => resolveLivePresetKey(schedule, settings, now, deviceId),
    [schedule, settings, now, deviceId],
  );

  const daySchedule = schedule.presets?.[activePresetKey];

  const saunasMeta = useMemo<Sauna[]>(() => {
    const visible = getVisibleSaunas(settings.saunas || []);
    return typeof limit === 'number' ? visible.slice(0, limit) : visible;
  }, [settings.saunas, limit]);

  const scheduleSaunaIndexByKey = useMemo(
    () => buildScheduleSaunaIndexMap(daySchedule?.saunas || []),
    [daySchedule],
  );

  const prestartMin = useMemo(() => readPrestartMinutes(settings), [settings]);

  const timeSlots = useMemo<string[]>(() => {
    if (!daySchedule?.rows) return [];
    return daySchedule.rows
      .map((row) => row.time)
      .slice()
      .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  }, [daySchedule]);

  const sortedRows = useMemo(() => {
    if (!daySchedule?.rows) return [];
    return daySchedule.rows.slice().sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [daySchedule]);

  const rawCells = useMemo<Array<Array<SchedulePanelCellExtras | null>>>(() => {
    if (!daySchedule || saunasMeta.length === 0) return saunasMeta.map(() => []);

    return saunasMeta.map((sauna) => {
      const saunaIndex = resolveScheduleSaunaIndex(
        daySchedule.saunas,
        sauna.name,
        scheduleSaunaIndexByKey,
      );
      if (saunaIndex < 0) return sortedRows.map(() => null);

      return sortedRows.map((row) => {
        const entry = row.entries?.[saunaIndex];
        if (!entry?.title) return null;
        const durationMin = entry.duration ?? 15;
        const status = getInfusionStatus(now, row.time, durationMin, prestartMin);
        const cell: SchedulePanelCellExtras = {
          title: entry.title,
          host: undefined,
          aromas: buildAromas(entry.badges, settings.aromas),
          isLive: status === 'ONGOING',
          isNext: false,
          time: row.time,
          durationMin,
          intensity: clampIntensity(entry.flames ?? 1),
          description: entry.description || entry.subtitle || '',
          isPrestart: status === 'PRESTART',
          isFinished: status === 'FINISHED',
        };
        return cell;
      });
    });
  }, [daySchedule, saunasMeta, scheduleSaunaIndexByKey, sortedRows, now, prestartMin, settings.aromas]);

  // Assign a single "next" marker to the earliest non-live, non-finished cell
  // across all saunas — matches the dashboard's global "next up" intent.
  const cells = useMemo(() => {
    type Pos = { saunaIdx: number; slotIdx: number; minutes: number };
    let earliest: Pos | null = null;
    rawCells.forEach((row, saunaIdx) => {
      row.forEach((cell, slotIdx) => {
        if (!cell || cell.isLive || cell.isFinished) return;
        const mins = timeToMinutes(cell.time);
        if (!earliest || mins < earliest.minutes) {
          earliest = { saunaIdx, slotIdx, minutes: mins };
        }
      });
    });
    if (!earliest) return rawCells;
    const winner = earliest as Pos;
    return rawCells.map((row, sIdx) =>
      row.map((cell, tIdx) => {
        if (!cell) return cell;
        if (sIdx === winner.saunaIdx && tIdx === winner.slotIdx) {
          return { ...cell, isNext: true };
        }
        return cell;
      }),
    );
  }, [rawCells]);

  return useMemo<SchedulePanelDataEnriched>(
    () => ({
      saunas: saunasMeta.map((s) => ({ id: s.id, name: s.name })),
      saunasMeta,
      timeSlots,
      cells,
      generatedAt: now.toISOString(),
    }),
    [saunasMeta, timeSlots, cells, now],
  );
}
