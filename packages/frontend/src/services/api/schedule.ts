import { createDefaultSchedule } from '@/types/schedule.types';
import type { Schedule, ScheduleResponse } from '@/types/schedule.types';
import { api } from './core';
import type { SaveVersionedResponse, ScheduleHistoryItem } from './types';

export const scheduleApi = {
  getSchedule: async (): Promise<Schedule> => {
    const { data } = await api.get<ScheduleResponse>('/schedule');
    if (!data || typeof data !== 'object' || !('presets' in data)) {
      const fallbackVersion = typeof (data as { version?: unknown } | undefined)?.version === 'number'
        ? (data as { version: number }).version
        : 1;
      const normalized = createDefaultSchedule();
      normalized.version = fallbackVersion;
      return normalized;
    }

    return data;
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
