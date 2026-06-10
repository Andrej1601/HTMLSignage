import { z } from 'zod';
import { getActiveEvent } from './settings.js';

/** Minimal shape these helpers need — accepts FE and BE Settings interchangeably. */
type EventLike = {
  isActive: boolean;
  startDate: string;
  startTime: string;
  endDate?: string | undefined;
  endTime?: string | undefined;
  targetDeviceIds?: string[] | undefined;
  assignedPreset: 'Evt1' | 'Evt2';
};
type SettingsLike = { events?: EventLike[] | undefined };

/**
 * Schedule domain — schema-first source of truth.
 * Migrated from `packages/backend/src/types/schedule.types.ts`.
 */

// Entry Schema (single cell in a time slot for a specific sauna)
export const EntrySchema = z.object({
  title: z.string().max(200),
  subtitle: z.string().max(200).optional(),
  flames: z.number().int().min(1).max(4).optional(), // 1-4 for intensity
  badges: z.array(z.string()).optional(),
  duration: z.number().int().min(1).max(180).optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
});

export type Entry = z.infer<typeof EntrySchema>;

// TimeRow Schema (one time slot with entries for each sauna)
export const TimeRowSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format'),
  entries: z.array(EntrySchema.nullable()), // One entry per sauna (null if empty)
});

export type TimeRow = z.infer<typeof TimeRowSchema>;

// DaySchedule Schema (schedule for a single day/preset)
export const DayScheduleSchema = z.object({
  saunas: z.array(z.string().max(100)),
  rows: z.array(TimeRowSchema),
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;

// PresetKey Schema
export const PresetKeySchema = z.enum([
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
  'Opt',
  'Evt1',
  'Evt2',
]);

export type PresetKey = z.infer<typeof PresetKeySchema>;

// Schedule Schema (complete schedule with all presets)
export const ScheduleSchema = z.object({
  version: z.number().int().positive(),
  presets: z.record(PresetKeySchema, DayScheduleSchema),
  autoPlay: z.boolean(),
  activePreset: PresetKeySchema.optional(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

// API Request Schemas
export const SaveScheduleRequestSchema = ScheduleSchema;

export type SaveScheduleRequest = z.infer<typeof SaveScheduleRequestSchema>;

// ─── Constants ──────────────────────────────────────────────────────────────

export const PRESET_KEYS: PresetKey[] = [
  'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2',
];

export const WEEKDAY_PRESETS: PresetKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SPECIAL_PRESETS: PresetKey[] = ['Opt', 'Evt1', 'Evt2'];

export const DEFAULT_SAUNAS = ['Vulkan', 'Nordisch', 'Bio'];

// ─── Pure Helpers ───────────────────────────────────────────────────────────

export function createEmptyDaySchedule(saunas: string[] = DEFAULT_SAUNAS): DaySchedule {
  return {
    saunas: [...saunas],
    rows: [],
  };
}

export function createDefaultSchedule(options?: { version?: number; saunas?: string[] }): Schedule {
  const version = options?.version ?? 1;
  const saunas = options?.saunas ?? DEFAULT_SAUNAS;
  const presets = Object.fromEntries(
    PRESET_KEYS.map((key) => [key, createEmptyDaySchedule(saunas)]),
  ) as Record<PresetKey, DaySchedule>;

  return {
    version: Math.max(1, Math.floor(version)),
    presets,
    autoPlay: false,
  };
}

export function normalizeScheduleData(raw: unknown): Schedule {
  const parsed = ScheduleSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const maybeVersion = (raw as { version?: unknown } | null)?.version;
  const version =
    typeof maybeVersion === 'number' && Number.isFinite(maybeVersion) ? maybeVersion : 1;
  return createDefaultSchedule({ version });
}

export function copyDaySchedule(source: DaySchedule): DaySchedule {
  // DaySchedule is plain JSON data (strings, numbers, arrays, nested objects)
  // so JSON round-trip clones safely without DOM/Node `structuredClone`.
  return JSON.parse(JSON.stringify(source)) as DaySchedule;
}

export function getTodayPresetKey(now: Date = new Date()): PresetKey {
  const day = now.getDay();
  const map: PresetKey[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return map[day]!;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function sortTimeRows(rows: TimeRow[]): TimeRow[] {
  return [...rows].sort((a, b) => {
    const [aH, aM] = a.time.split(':').map(Number);
    const [bH, bM] = b.time.split(':').map(Number);
    return ((aH ?? 0) * 60 + (aM ?? 0)) - ((bH ?? 0) * 60 + (bM ?? 0));
  });
}

/** Normalize sauna names so schedule mappings survive cosmetic renames. */
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

/**
 * Active preset key considering events. If an event is active for this
 * device, returns the event's assigned preset; otherwise returns today's
 * weekday preset.
 */
export function getActivePresetKey(
  settings?: SettingsLike | null,
  now: Date = new Date(),
  deviceId?: string | null,
): PresetKey {
  if (!settings) return getTodayPresetKey(now);
  const activeEvent = getActiveEvent(settings, now, deviceId);
  if (activeEvent) {
    return activeEvent.assignedPreset;
  }
  return getTodayPresetKey(now);
}

/**
 * The effective live preset for displays/admin preview:
 *   1) active event preset
 *   2) auto-play weekday preset
 *   3) manual `activePreset`
 *
 * Fail-safe: a manual `Evt1`/`Evt2` without an active event falls back
 * to the weekday preset so stale event plans cannot stay live after
 * the event window has ended.
 */
export function resolveLivePresetKey(
  schedule: Pick<Schedule, 'autoPlay' | 'activePreset'>,
  settings?: SettingsLike | null,
  now: Date = new Date(),
  deviceId?: string | null,
): PresetKey {
  const todayPreset = getTodayPresetKey(now);
  const activeEventPreset = settings ? getActiveEvent(settings, now, deviceId)?.assignedPreset : undefined;

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

/** Re-map a schedule's sauna columns when the sauna list changes. */
export function syncScheduleWithSaunas(schedule: Schedule, saunaNames: string[]): Schedule {
  const updatedPresets: Record<PresetKey, DaySchedule> = {} as Record<PresetKey, DaySchedule>;

  (Object.keys(schedule.presets) as PresetKey[]).forEach((presetKey) => {
    const preset = schedule.presets[presetKey];
    if (!preset) return;
    const oldSaunas = preset.saunas;

    const oldIndexByKey = new Map<string, number>();
    oldSaunas.forEach((name, idx) => {
      const key = normalizeSaunaNameKey(name);
      if (key && !oldIndexByKey.has(key)) oldIndexByKey.set(key, idx);
    });

    const updatedRows = preset.rows.map((row) => {
      const newEntries: (Entry | null)[] = saunaNames.map((saunaName) => {
        const key = normalizeSaunaNameKey(saunaName);
        const oldIndex = key ? oldIndexByKey.get(key) : undefined;
        return typeof oldIndex === 'number' ? (row.entries[oldIndex] ?? null) : null;
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
