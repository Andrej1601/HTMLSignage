import { z } from 'zod';

// Cell Schema
export const CellSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format'),
  title: z.string().max(200),
  subtitle: z.string().max(200).optional(),
  badges: z.array(z.string()).optional(),
  duration: z.number().int().min(1).max(180).optional(),
  notes: z.string().optional(),
});

export type Cell = z.infer<typeof CellSchema>;

// Row Schema
export const RowSchema = z.object({
  sauna: z.string().max(100),
  dayOffset: z.number().int().min(0).max(6),
  cells: z.array(CellSchema),
});

export type Row = z.infer<typeof RowSchema>;

// Schedule Schema
export const ScheduleSchema = z.object({
  version: z.number().int().positive(),
  rows: z.array(RowSchema),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

// API Request Schemas
export const SaveScheduleRequestSchema = ScheduleSchema;

export type SaveScheduleRequest = z.infer<typeof SaveScheduleRequestSchema>;
