import { z } from 'zod';

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
  saunas: z.array(z.string().max(100)), // ["Vulkan", "Nordisch", "Bio"]
  rows: z.array(TimeRowSchema), // Time rows sorted by time
});

export type DaySchedule = z.infer<typeof DayScheduleSchema>;

// PresetKey Schema
export const PresetKeySchema = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2']);

export type PresetKey = z.infer<typeof PresetKeySchema>;

// Schedule Schema (complete schedule with all presets)
export const ScheduleSchema = z.object({
  version: z.number().int().positive(),
  presets: z.record(PresetKeySchema, DayScheduleSchema),
  autoPlay: z.boolean(), // Auto-load today's preset
  activePreset: PresetKeySchema.optional(), // Currently active preset (for manual mode)
});

export type Schedule = z.infer<typeof ScheduleSchema>;

// API Request Schemas
export const SaveScheduleRequestSchema = ScheduleSchema;

export type SaveScheduleRequest = z.infer<typeof SaveScheduleRequestSchema>;
