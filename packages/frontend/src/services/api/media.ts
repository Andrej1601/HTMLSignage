import type { Media, MediaFilter } from '@/types/media.types';
import { api } from './core';
import type { ApiOkResponse } from './types';

export const mediaApi = {
  getMedia: async (filter?: MediaFilter): Promise<Media[]> => {
    const params = new URLSearchParams();
    params.append('limit', '500');
    if (filter?.type) params.append('type', filter.type);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.tag) params.append('tag', filter.tag);

    const { data } = await api.get('/media', { params });
    return data;
  },

  getTags: async (): Promise<string[]> => {
    const { data } = await api.get<string[]>('/media/tags');
    return data;
  },

  getMediaItem: async (id: string): Promise<Media> => {
    const { data } = await api.get(`/media/${id}`);
    return data;
  },

  uploadMedia: async (file: File): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/media/upload', formData);
    return data;
  },

  deleteMedia: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/media/${id}`);
    return data;
  },

  updateMediaTags: async (id: string, tags: string[]): Promise<Media> => {
    const { data } = await api.patch<Media>(`/media/${id}/tags`, { tags });
    return data;
  },
};
