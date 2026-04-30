// Frontend Schedule Types — single source of truth lives in @htmlsignage/shared.
// This module re-exports inferred types/helpers and adds FE-specific UI bits.
import type {
  PresetKey,
  Schedule,
} from '@htmlsignage/shared/schedule';
import type { Entry } from '@htmlsignage/shared/schedule';

// Inferred types
export type {
  Entry,
  TimeRow,
  DaySchedule,
  PresetKey,
  Schedule,
} from '@htmlsignage/shared/schedule';

export type ScheduleResponse = Schedule;

// Pure helpers + constants — single source of truth in shared.
export {
  PRESET_KEYS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  DEFAULT_SAUNAS,
  createEmptyDaySchedule,
  createDefaultSchedule,
  copyDaySchedule,
  getTodayPresetKey,
  getActivePresetKey,
  resolveLivePresetKey,
  isValidTime,
  sortTimeRows,
  normalizeSaunaNameKey,
  syncScheduleWithSaunas,
} from '@htmlsignage/shared/schedule';

// ─── FE-specific UI extras ──────────────────────────────────────────────────

export interface CellEditState {
  timeRowIndex: number;
  saunaIndex: number;
  entry: Entry | null;
}

export interface ScheduleEditorState {
  schedule: Schedule;
  selectedCell: CellEditState | null;
  isDirty: boolean;
  isSaving: boolean;
}

// German UI labels — stay FE-only.
export const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export const PRESET_LABELS: Record<PresetKey, string> = {
  Mon: 'Montag',
  Tue: 'Dienstag',
  Wed: 'Mittwoch',
  Thu: 'Donnerstag',
  Fri: 'Freitag',
  Sat: 'Samstag',
  Sun: 'Sonntag',
  Opt: 'Optional',
  Evt1: 'Event 1',
  Evt2: 'Event 2',
};

export function getDayLabel(offset: number): string {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + offset);
  const dayName = DAYS[targetDate.getDay()];

  if (offset === 0) return `Heute (${dayName})`;
  if (offset === 1) return `Morgen (${dayName})`;
  return `${dayName} (+${offset}d)`;
}

export function formatTime(time: string): string {
  return time; // Already in HH:MM format
}
