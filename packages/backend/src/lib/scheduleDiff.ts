import type { Schedule, DaySchedule, TimeRow, Entry } from '../types/schedule.types.js';

const PRESET_LABELS: Record<string, string> = {
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

function getEntryLabel(entry: Entry | null): string {
  if (!entry) return '(leer)';
  return entry.title || '(ohne Titel)';
}

function diffSaunas(
  oldSaunas: string[],
  newSaunas: string[],
  presetLabel: string,
  changes: string[],
): void {
  const added = newSaunas.filter((s) => !oldSaunas.includes(s));
  const removed = oldSaunas.filter((s) => !newSaunas.includes(s));
  for (const s of added) changes.push(`${presetLabel}: Sauna '${s}' hinzugefügt`);
  for (const s of removed) changes.push(`${presetLabel}: Sauna '${s}' entfernt`);
}

function diffRows(
  oldDay: DaySchedule,
  newDay: DaySchedule,
  presetLabel: string,
  changes: string[],
): void {
  const oldByTime = new Map<string, TimeRow>();
  for (const row of oldDay.rows) oldByTime.set(row.time, row);

  const newByTime = new Map<string, TimeRow>();
  for (const row of newDay.rows) newByTime.set(row.time, row);

  // Added time slots
  for (const time of newByTime.keys()) {
    if (!oldByTime.has(time)) {
      changes.push(`${presetLabel}: Zeitslot ${time} hinzugefügt`);
    }
  }

  // Removed time slots
  for (const time of oldByTime.keys()) {
    if (!newByTime.has(time)) {
      changes.push(`${presetLabel}: Zeitslot ${time} entfernt`);
    }
  }

  // Changed entries at shared time slots
  for (const [time, newRow] of newByTime) {
    const oldRow = oldByTime.get(time);
    if (!oldRow) continue;

    const maxLen = Math.max(oldRow.entries.length, newRow.entries.length);
    for (let i = 0; i < maxLen; i++) {
      const oldEntry = oldRow.entries[i] ?? null;
      const newEntry = newRow.entries[i] ?? null;
      const oldLabel = getEntryLabel(oldEntry);
      const newLabel = getEntryLabel(newEntry);

      if (oldLabel !== newLabel) {
        const saunaName = newDay.saunas[i] || oldDay.saunas[i] || `Spalte ${i + 1}`;
        changes.push(`${presetLabel} ${time}, ${saunaName}: '${oldLabel}' → '${newLabel}'`);
      }
    }
  }
}

/**
 * Computes a human-readable summary of changes between two schedule versions.
 * Returns an array of German-language change descriptions, capped at 10 items.
 */
export function computeScheduleChangeSummary(
  current: Schedule,
  previous: Schedule,
): string[] {
  const changes: string[] = [];

  // AutoPlay changes
  if (current.autoPlay !== previous.autoPlay) {
    changes.push(current.autoPlay ? 'Auto-Play aktiviert' : 'Auto-Play deaktiviert');
  }

  // Active preset changes
  if (current.activePreset !== previous.activePreset) {
    const oldName = PRESET_LABELS[previous.activePreset || ''] || previous.activePreset || '–';
    const newName = PRESET_LABELS[current.activePreset || ''] || current.activePreset || '–';
    changes.push(`Aktives Preset: ${oldName} → ${newName}`);
  }

  // Diff each preset
  const allKeys = new Set([
    ...Object.keys(current.presets || {}),
    ...Object.keys(previous.presets || {}),
  ]);

  for (const key of allKeys) {
    const label = PRESET_LABELS[key] || key;
    const cur = (current.presets as Record<string, DaySchedule>)?.[key];
    const prev = (previous.presets as Record<string, DaySchedule>)?.[key];

    if (!prev && cur) {
      changes.push(`${label}: Neues Preset angelegt`);
      continue;
    }
    if (prev && !cur) {
      changes.push(`${label}: Preset entfernt`);
      continue;
    }
    if (!cur || !prev) continue;

    diffSaunas(prev.saunas, cur.saunas, label, changes);
    diffRows(prev, cur, label, changes);
  }

  // Cap at 10
  if (changes.length > 10) {
    const extra = changes.length - 9;
    return [...changes.slice(0, 9), `... und ${extra} weitere Änderungen`];
  }

  return changes.length > 0 ? changes : ['Keine sichtbaren Änderungen'];
}
