import type { SlideshowDefinition, SlideshowConfig } from '@/types/slideshow.types';
import { api } from './core';
import type { ApiOkResponse } from './types';

export interface CreateSlideshowRequest {
  name: string;
  copyFromId?: string;
}

export interface UpdateSlideshowRequest {
  name?: string;
  config?: SlideshowConfig;
  isDefault?: boolean;
}

export const slideshowsApi = {
  list: async (): Promise<SlideshowDefinition[]> => {
    const { data } = await api.get('/slideshows');
    return data;
  },

  get: async (id: string): Promise<SlideshowDefinition> => {
    const { data } = await api.get(`/slideshows/${id}`);
    return data;
  },

  create: async (payload: CreateSlideshowRequest): Promise<SlideshowDefinition> => {
    const { data } = await api.post('/slideshows', payload);
    return data;
  },

  update: async (id: string, payload: UpdateSlideshowRequest): Promise<SlideshowDefinition> => {
    const { data } = await api.patch(`/slideshows/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/slideshows/${id}`);
    return data;
  },
};
