import { getActiveEvent, type Settings } from '@/types/settings.types';
import {
  copyDaySchedule,
  getTodayPresetKey,
  resolveLivePresetKey,
  sortTimeRows,
  type DaySchedule,
  type Entry,
  type PresetKey,
  type Schedule,
  type TimeRow,
} from '@/types/schedule.types';

function updatePresetSchedule(
  schedule: Schedule,
  presetKey: PresetKey,
  updateDaySchedule: (daySchedule: DaySchedule) => DaySchedule,
): Schedule {
  return {
    ...schedule,
    presets: {
      ...schedule.presets,
      [presetKey]: updateDaySchedule(schedule.presets[presetKey]),
    },
  };
}

function updatePresetRows(
  schedule: Schedule,
  presetKey: PresetKey,
  updateRows: (rows: TimeRow[]) => TimeRow[],
): Schedule {
  return updatePresetSchedule(schedule, presetKey, (daySchedule) => ({
    ...daySchedule,
    rows: updateRows(daySchedule.rows),
  }));
}

export function formatDateTimeLocalInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function resolveInitialEditingPreset(
  schedule: Pick<Schedule, 'autoPlay' | 'activePreset'>,
  settings?: Settings | null,
): PresetKey {
  if (schedule.autoPlay) {
    return resolveLivePresetKey(schedule, settings);
  }

  if (schedule.activePreset) {
    return schedule.activePreset;
  }

  return getTodayPresetKey();
}

export function withManualActivePreset(schedule: Schedule, activePreset: PresetKey): Schedule {
  return {
    ...schedule,
    activePreset,
  };
}

export function withAutoPlayToggled(
  schedule: Schedule,
  settings?: Settings | null,
  now: Date = new Date(),
): Schedule {
  const nextAutoPlay = !schedule.autoPlay;
  const weekdayPreset = getTodayPresetKey(now);
  const activeEvent = settings ? getActiveEvent(settings, now) : null;
  const livePreset = resolveLivePresetKey(schedule, settings, now);
  const manualPresetFallback: PresetKey = activeEvent
    ? weekdayPreset
    : (livePreset === 'Evt1' || livePreset === 'Evt2' ? weekdayPreset : livePreset);

  return {
    ...schedule,
    autoPlay: nextAutoPlay,
    activePreset: nextAutoPlay ? undefined : manualPresetFallback,
  };
}

export function withCopiedPreset(
  schedule: Schedule,
  sourcePreset: PresetKey,
  targetPreset: PresetKey,
): Schedule {
  return {
    ...schedule,
    presets: {
      ...schedule.presets,
      [targetPreset]: copyDaySchedule(schedule.presets[sourcePreset]),
    },
  };
}

export function withAddedTimeRow(schedule: Schedule, presetKey: PresetKey, time: string): Schedule {
  return updatePresetRows(schedule, presetKey, (rows) => {
    const nextRow: TimeRow = {
      time,
      entries: schedule.presets[presetKey].saunas.map(() => null),
    };
    return sortTimeRows([...rows, nextRow]);
  });
}

export function withUpdatedTimeRow(
  schedule: Schedule,
  presetKey: PresetKey,
  timeRowIndex: number,
  time: string,
): Schedule {
  return updatePresetRows(schedule, presetKey, (rows) => {
    const updatedRows = [...rows];
    updatedRows[timeRowIndex] = {
      ...updatedRows[timeRowIndex],
      time,
    };
    return sortTimeRows(updatedRows);
  });
}

export function withDeletedTimeRow(schedule: Schedule, presetKey: PresetKey, timeRowIndex: number): Schedule {
  return updatePresetRows(schedule, presetKey, (rows) => rows.filter((_, index) => index !== timeRowIndex));
}

export function withCellEntry(
  schedule: Schedule,
  presetKey: PresetKey,
  timeRowIndex: number,
  saunaIndex: number,
  entry: Entry | null,
): Schedule {
  return updatePresetRows(schedule, presetKey, (rows) => {
    const updatedRows = [...rows];
    const currentRow = updatedRows[timeRowIndex];
    const updatedEntries = [...currentRow.entries];
    updatedEntries[saunaIndex] = entry;
    updatedRows[timeRowIndex] = {
      ...currentRow,
      entries: updatedEntries,
    };
    return updatedRows;
  });
}

export function withIncrementedScheduleVersion(schedule: Schedule): Schedule {
  return {
    ...schedule,
    version: (schedule.version || 1) + 1,
  };
}
