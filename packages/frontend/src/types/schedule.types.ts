// Frontend Schedule Types (matching backend Zod schemas)

export interface Cell {
  time: string; // "HH:MM"
  title: string;
  subtitle?: string;
  badges?: string[];
  duration?: number; // minutes
  notes?: string;
}

export interface Row {
  sauna: string;
  dayOffset: number; // 0-6 (0 = today, 1 = tomorrow, etc.)
  cells: Cell[];
}

export interface Schedule {
  version: number;
  rows: Row[];
}

export interface ScheduleResponse {
  version: number;
  rows: Row[];
}

// UI State Types
export interface CellEditState {
  rowIndex: number;
  cellIndex: number;
  cell: Cell;
}

export interface ScheduleEditorState {
  schedule: Schedule;
  selectedCell: CellEditState | null;
  isDirty: boolean;
  isSaving: boolean;
}

// Day names
export const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

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
