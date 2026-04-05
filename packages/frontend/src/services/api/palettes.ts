import type { ThemeColors } from '@/types/settings.types';
import { api } from './core';
import type { ApiOkResponse, CustomPalette } from './types';

export const palettesApi = {
  getAll: async (): Promise<CustomPalette[]> => {
    const { data } = await api.get<CustomPalette[]>('/palettes');
    return data;
  },

  create: async (name: string, colors: Partial<ThemeColors>): Promise<CustomPalette> => {
    const { data } = await api.post<CustomPalette>('/palettes', { name, colors });
    return data;
  },

  update: async (id: string, name: string, colors: Partial<ThemeColors>): Promise<CustomPalette> => {
    const { data } = await api.put<CustomPalette>(`/palettes/${id}`, { name, colors });
    return data;
  },

  delete: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/palettes/${id}`);
    return data;
  },
};
