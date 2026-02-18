// Frontend Schedule Types (matching backend Zod schemas)
import type { Settings } from './settings.types';
import { getActiveEvent } from './settings.types';

// Entry in a time slot for a specific sauna
export interface Entry {
  title: string;
  subtitle?: string;
  flames?: number; // 1-4 for intensity
  badges?: string[];
  duration?: number; // minutes
  notes?: string;
  description?: string;
}

// A row represents a time slot with entries for each sauna
export interface TimeRow {
  time: string; // "HH:MM"
  entries: (Entry | null)[]; // One entry per sauna (or null if empty)
}

// Day schedule with saunas and time rows
export interface DaySchedule {
  saunas: string[]; // ["Vulkan", "Nordisch", "Bio"]
  rows: TimeRow[]; // Sorted by time
}

// Preset keys
export type PresetKey = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' | 'Opt' | 'Evt1' | 'Evt2';

// Schedule with presets for each day
export interface Schedule {
  version: number;
  presets: Record<PresetKey, DaySchedule>;
  autoPlay: boolean; // Auto-load today's preset
  activePreset?: PresetKey; // Currently active preset (for manual mode)
}

export interface ScheduleResponse extends Schedule {}

// UI State Types
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

// Day names
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

export const WEEKDAY_PRESETS: PresetKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SPECIAL_PRESETS: PresetKey[] = ['Opt', 'Evt1', 'Evt2'];

// Helper to get current weekday preset key
export function getTodayPresetKey(now: Date = new Date()): PresetKey {
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const map: PresetKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return map[day];
}

// Helper to get active preset key (considering events)
// If an event is active, returns the event's assigned preset
// Otherwise returns the current weekday preset
export function getActivePresetKey(settings?: Settings | null, now: Date = new Date()): PresetKey {
  if (!settings) return getTodayPresetKey(now);

  const activeEvent = getActiveEvent(settings, now);
  if (activeEvent) {
    return activeEvent.assignedPreset;
  }

  return getTodayPresetKey(now);
}

// Resolves the effective live preset for displays/admin preview:
// 1) active event preset
// 2) auto-play weekday preset
// 3) manual activePreset
//    - fail-safe: manual Evt1/Evt2 without active event falls back to weekday
//      to avoid stale event plans staying live after an event has ended.
export function resolveLivePresetKey(
  schedule: Pick<Schedule, 'autoPlay' | 'activePreset'>,
  settings?: Settings | null,
  now: Date = new Date(),
): PresetKey {
  const todayPreset = getTodayPresetKey(now);
  const activeEventPreset = settings ? getActiveEvent(settings, now)?.assignedPreset : undefined;

  if (activeEventPreset) {
    return activeEventPreset;
  }

  if (schedule.autoPlay) {
    return todayPreset;
  }

  const manualPreset = schedule.activePreset;
  if (!manualPreset) {
    return todayPreset;
  }

  if (manualPreset === 'Evt1' || manualPreset === 'Evt2') {
    return todayPreset;
  }

  return manualPreset;
}

// Helper to get day label
export function getDayLabel(offset: number): string {
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + offset);
  const dayName = DAYS[targetDate.getDay()];

  if (offset === 0) return `Heute (${dayName})`;
  if (offset === 1) return `Morgen (${dayName})`;
  return `${dayName} (+${offset}d)`;
}

// Helper to format time
export function formatTime(time: string): string {
  return time; // Already in HH:MM format
}

// Helper to validate time
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

// Helper to sort time rows
export function sortTimeRows(rows: TimeRow[]): TimeRow[] {
  return [...rows].sort((a, b) => {
    const [aH, aM] = a.time.split(':').map(Number);
    const [bH, bM] = b.time.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
}

// Helper to create empty day schedule
export function createEmptyDaySchedule(saunas: string[] = []): DaySchedule {
  return {
    saunas: [...saunas],
    rows: [],
  };
}

// Helper to create default schedule
export function createDefaultSchedule(): Schedule {
  const defaultSaunas = ['Vulkan', 'Nordisch', 'Bio'];
  const emptyPresets: Record<PresetKey, DaySchedule> = {
    Mon: createEmptyDaySchedule(defaultSaunas),
    Tue: createEmptyDaySchedule(defaultSaunas),
    Wed: createEmptyDaySchedule(defaultSaunas),
    Thu: createEmptyDaySchedule(defaultSaunas),
    Fri: createEmptyDaySchedule(defaultSaunas),
    Sat: createEmptyDaySchedule(defaultSaunas),
    Sun: createEmptyDaySchedule(defaultSaunas),
    Opt: createEmptyDaySchedule(defaultSaunas),
    Evt1: createEmptyDaySchedule(defaultSaunas),
    Evt2: createEmptyDaySchedule(defaultSaunas),
  };

  return {
    version: 1,
    presets: emptyPresets,
    autoPlay: false,
  };
}

// Helper to copy day schedule
export function copyDaySchedule(source: DaySchedule): DaySchedule {
  return JSON.parse(JSON.stringify(source));
}

// Normalize sauna names so schedule mappings survive cosmetic renames (case, hyphens, umlauts, etc.).
export function normalizeSaunaNameKey(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Helper to sync schedule with settings saunas
export function syncScheduleWithSaunas(schedule: Schedule, saunaNames: string[]): Schedule {
  const updatedPresets: Record<PresetKey, DaySchedule> = {} as Record<PresetKey, DaySchedule>;

  (Object.keys(schedule.presets) as PresetKey[]).forEach((presetKey) => {
    const preset = schedule.presets[presetKey];
    const oldSaunas = preset.saunas;

    const oldIndexByKey = new Map<string, number>();
    oldSaunas.forEach((name, idx) => {
      const key = normalizeSaunaNameKey(name);
      if (key && !oldIndexByKey.has(key)) oldIndexByKey.set(key, idx);
    });

    // Create new rows with updated entries array
    const updatedRows = preset.rows.map((row) => {
      const newEntries: (Entry | null)[] = saunaNames.map((saunaName) => {
        const key = normalizeSaunaNameKey(saunaName);
        const oldIndex = key ? oldIndexByKey.get(key) : undefined;
        return typeof oldIndex === 'number' ? row.entries[oldIndex] : null;
      });

      return {
        time: row.time,
        entries: newEntries,
      };
    });

    updatedPresets[presetKey] = {
      saunas: [...saunaNames],
      rows: updatedRows,
    };
  });

  return {
    ...schedule,
    presets: updatedPresets,
  };
}
