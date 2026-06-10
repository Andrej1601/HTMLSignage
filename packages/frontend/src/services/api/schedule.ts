import { createDefaultSchedule } from '@/types/schedule.types';
import type { Schedule } from '@/types/schedule.types';
import { ScheduleSchema } from '@htmlsignage/shared/schedule';
import { api } from './core';
import type { SaveVersionedResponse, ScheduleHistoryItem } from './types';

export const scheduleApi = {
  getSchedule: async (): Promise<Schedule> => {
    const { data } = await api.get<unknown>('/schedule');
    const parsed = ScheduleSchema.safeParse(data);
    if (parsed.success) {
      return parsed.data;
    }

    console.warn('[scheduleApi] Invalid schedule payload, falling back to default:', parsed.error.issues);
    const fallbackVersion = typeof (data as { version?: unknown } | undefined)?.version === 'number'
      ? (data as { version: number }).version
      : 1;
    const normalized = createDefaultSchedule();
    normalized.version = fallbackVersion;
    return normalized;
  },

  saveSchedule: async (schedule: Schedule): Promise<SaveVersionedResponse> => {
    const { data } = await api.post<SaveVersionedResponse>('/schedule', schedule);
    return data;
  },

  getHistory: async (limit = 10): Promise<ScheduleHistoryItem[]> => {
    const { data } = await api.get<ScheduleHistoryItem[]>('/schedule/history', { params: { limit, details: 'true' } });
    return data;
  },
};
