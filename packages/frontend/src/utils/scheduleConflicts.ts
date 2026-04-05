import type { DaySchedule, Entry } from '@/types/schedule.types';

export interface ScheduleConflict {
  type: 'overlap' | 'short-gap';
  saunaIndex: number;
  rowIndex: number;
  message: string;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function detectConflicts(schedule: DaySchedule, minGapMinutes = 5): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  if (!schedule.rows || schedule.rows.length === 0) return conflicts;

  const saunaCount = schedule.saunas.length;

  for (let col = 0; col < saunaCount; col++) {
    // Collect entries with times for this sauna
    const entries: Array<{
      rowIndex: number;
      startMin: number;
      endMin: number;
      entry: Entry;
    }> = [];

    for (let row = 0; row < schedule.rows.length; row++) {
      const entry = schedule.rows[row].entries[col];
      if (!entry) continue;

      const startMin = timeToMinutes(schedule.rows[row].time);
      const duration = entry.duration || 15;
      entries.push({
        rowIndex: row,
        startMin,
        endMin: startMin + duration,
        entry,
      });
    }

    // Sort by start time
    entries.sort((a, b) => a.startMin - b.startMin);

    // Check consecutive entries
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];

      if (curr.startMin < prev.endMin) {
        // Overlap
        conflicts.push({
          type: 'overlap',
          saunaIndex: col,
          rowIndex: curr.rowIndex,
          message: `Überlappung: "${curr.entry.title}" startet bevor "${prev.entry.title}" endet`,
        });
      } else if (curr.startMin - prev.endMin < minGapMinutes && curr.startMin > prev.endMin) {
        // Too short gap
        const gap = curr.startMin - prev.endMin;
        conflicts.push({
          type: 'short-gap',
          saunaIndex: col,
          rowIndex: curr.rowIndex,
          message: `Nur ${gap} Min. Pause zwischen "${prev.entry.title}" und "${curr.entry.title}"`,
        });
      }
    }
  }

  return conflicts;
}

export function getConflictsForCell(
  conflicts: ScheduleConflict[],
  rowIndex: number,
  saunaIndex: number
): ScheduleConflict[] {
  return conflicts.filter(
    (c) => c.rowIndex === rowIndex && c.saunaIndex === saunaIndex
  );
}
