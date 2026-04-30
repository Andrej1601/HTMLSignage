/**
 * Schedule types — Single source of truth lives in @htmlsignage/shared.
 * This module re-exports for backward compatibility with existing imports.
 */
export {
  EntrySchema,
  TimeRowSchema,
  DayScheduleSchema,
  PresetKeySchema,
  ScheduleSchema,
  SaveScheduleRequestSchema,
} from '@htmlsignage/shared/schedule';

export type {
  Entry,
  TimeRow,
  DaySchedule,
  PresetKey,
  Schedule,
  SaveScheduleRequest,
} from '@htmlsignage/shared/schedule';
