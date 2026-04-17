import { api } from './core';
import { API_LONG_REQUEST_TIMEOUT_MS } from '@/utils/constants';
import type {
  SystemAuditLogResponse,
  SystemBackupPreviewResponse,
  SystemJobDetailResponse,
  SystemJobListResponse,
  SystemJobStartResponse,
  SystemReleasesResponse,
  SystemRuntimeHistoryResponse,
  SystemRuntimeStatusResponse,
} from './types';

export const systemApi = {
  getRuntimeStatus: async (): Promise<SystemRuntimeStatusResponse> => {
    const { data } = await api.get<SystemRuntimeStatusResponse>('/system/runtime-status');
    return data;
  },

  getRuntimeHistory: async (hours = 24): Promise<SystemRuntimeHistoryResponse> => {
    const { data } = await api.get<SystemRuntimeHistoryResponse>('/system/runtime-history', {
      params: { hours },
    });
    return data;
  },

  getReleases: async (): Promise<SystemReleasesResponse> => {
    const { data } = await api.get<SystemReleasesResponse>('/system/update/status');
    return data;
  },

  runUpdate: async (targetVersion: string): Promise<SystemJobStartResponse> => {
    const { data } = await api.post<SystemJobStartResponse>('/system/update/run', { targetVersion });
    return data;
  },

  exportBackup: async (): Promise<Blob> => {
    const { data } = await api.get('/system/backup/export', {
      responseType: 'blob',
      timeout: API_LONG_REQUEST_TIMEOUT_MS,
    });
    return data as Blob;
  },

  importBackup: async (backupFile: File, replaceMedia = true): Promise<SystemJobStartResponse> => {
    const formData = new FormData();
    formData.append('backup', backupFile);
    formData.append('replaceMedia', replaceMedia ? 'true' : 'false');

    const { data } = await api.post<SystemJobStartResponse>('/system/backup/import', formData, {
      timeout: API_LONG_REQUEST_TIMEOUT_MS,
    });
    return data;
  },

  previewBackupImport: async (
    backupFile: File,
    replaceMedia = true,
  ): Promise<SystemBackupPreviewResponse> => {
    const formData = new FormData();
    formData.append('backup', backupFile);
    formData.append('replaceMedia', replaceMedia ? 'true' : 'false');

    const { data } = await api.post<SystemBackupPreviewResponse>('/system/backup/import/preview', formData, {
      timeout: API_LONG_REQUEST_TIMEOUT_MS,
    });
    return data;
  },

  getAuditLog: async (limit = 50, cursor?: string | null): Promise<SystemAuditLogResponse> => {
    const { data } = await api.get<SystemAuditLogResponse>('/system/audit', {
      params: {
        limit,
        ...(cursor ? { cursor } : {}),
      },
    });
    return data;
  },

  listJobs: async (limit = 20): Promise<SystemJobListResponse> => {
    const { data } = await api.get<SystemJobListResponse>('/system/jobs', {
      params: { limit },
    });
    return data;
  },

  getJob: async (jobId: string): Promise<SystemJobDetailResponse> => {
    const { data } = await api.get<SystemJobDetailResponse>(`/system/jobs/${jobId}`);
    return data;
  },
};
