import type { Settings } from '@/types/settings.types';
import { api } from './core';
import type { SaveVersionedResponse } from './types';

export const settingsApi = {
  getSettings: async (): Promise<Settings> => {
    const { data } = await api.get<Settings>('/settings');
    return data;
  },

  saveSettings: async (settings: Settings): Promise<SaveVersionedResponse> => {
    const { data } = await api.post<SaveVersionedResponse>('/settings', settings);
    return data;
  },
};
