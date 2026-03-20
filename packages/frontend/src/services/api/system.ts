import { api, getAuthHeaders } from './core';
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
  getRuntimeStatus: async (token: string): Promise<SystemRuntimeStatusResponse> => {
    const { data } = await api.get<SystemRuntimeStatusResponse>('/system/runtime-status', {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  getRuntimeHistory: async (token: string, hours = 24): Promise<SystemRuntimeHistoryResponse> => {
    const { data } = await api.get<SystemRuntimeHistoryResponse>('/system/runtime-history', {
      headers: getAuthHeaders(token),
      params: { hours },
    });
    return data;
  },

  getReleases: async (token: string): Promise<SystemReleasesResponse> => {
    const { data } = await api.get<SystemReleasesResponse>('/system/update/status', {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  runUpdate: async (token: string, targetVersion: string): Promise<SystemJobStartResponse> => {
    const { data } = await api.post<SystemJobStartResponse>('/system/update/run', { targetVersion }, {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  exportBackup: async (token: string): Promise<Blob> => {
    const { data } = await api.get('/system/backup/export', {
      headers: getAuthHeaders(token),
      responseType: 'blob',
    });
    return data as Blob;
  },

  importBackup: async (token: string, backupFile: File, replaceMedia = true): Promise<SystemJobStartResponse> => {
    const formData = new FormData();
    formData.append('backup', backupFile);
    formData.append('replaceMedia', replaceMedia ? 'true' : 'false');

    const { data } = await api.post<SystemJobStartResponse>('/system/backup/import', formData, {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  previewBackupImport: async (
    token: string,
    backupFile: File,
    replaceMedia = true,
  ): Promise<SystemBackupPreviewResponse> => {
    const formData = new FormData();
    formData.append('backup', backupFile);
    formData.append('replaceMedia', replaceMedia ? 'true' : 'false');

    const { data } = await api.post<SystemBackupPreviewResponse>('/system/backup/import/preview', formData, {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  getAuditLog: async (token: string, limit = 50, cursor?: string | null): Promise<SystemAuditLogResponse> => {
    const { data } = await api.get<SystemAuditLogResponse>('/system/audit', {
      headers: getAuthHeaders(token),
      params: {
        limit,
        ...(cursor ? { cursor } : {}),
      },
    });
    return data;
  },

  listJobs: async (token: string, limit = 20): Promise<SystemJobListResponse> => {
    const { data } = await api.get<SystemJobListResponse>('/system/jobs', {
      headers: getAuthHeaders(token),
      params: { limit },
    });
    return data;
  },

  getJob: async (token: string, jobId: string): Promise<SystemJobDetailResponse> => {
    const { data } = await api.get<SystemJobDetailResponse>(`/system/jobs/${jobId}`, {
      headers: getAuthHeaders(token),
    });
    return data;
  },
};
