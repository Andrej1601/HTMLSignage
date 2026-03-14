import axios from 'axios';
import type { Schedule, ScheduleResponse } from '@/types/schedule.types';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { Device, CreateDeviceRequest, UpdateDeviceRequest, DeviceControlCommand } from '@/types/device.types';
import type { Media, MediaFilter } from '@/types/media.types';
import type { Settings, ThemeColors } from '@/types/settings.types';

export interface ApiOkResponse {
  ok: boolean;
}

export interface SaveVersionedResponse extends ApiOkResponse {
  version: number;
}

export interface ScheduleHistoryItem {
  id: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  changeSummary?: string[] | null;
}

export interface DeviceOverridesPayload {
  schedule?: Schedule;
  settings?: Partial<Settings>;
}

export interface DeviceDisplayConfigResponse {
  deviceId: string;
  mode: 'auto' | 'override';
  hasScheduleOverride: boolean;
  hasSettingsOverride: boolean;
  schedule: Schedule;
  settings: Settings;
}

export interface GitHubRelease {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
}

export interface SystemReleasesResponse extends ApiOkResponse {
  currentVersion: string;
  latestRelease: GitHubRelease | null;
  hasUpdate: boolean;
  olderReleases: GitHubRelease[];
  isDirty: boolean;
  isRunning: boolean;
  checkedAt: string;
}

export interface SystemUpdateRunResponse extends ApiOkResponse {
  newVersion: string;
  targetVersion: string;
  log: string;
  finishedAt: string;
  note?: string;
  backupPath?: string;
  rolledBack?: boolean;
}

export interface SystemBackupImportResponse extends ApiOkResponse {
  importedMedia: number;
  replaceMedia: boolean;
  importedAt: string;
  importedScheduleVersion?: number;
  importedSettingsVersion?: number;
  warnings?: string[];
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from localStorage to every request unless already set.
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let hasWarnedDisplayConfigFallback = false;

function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getDeviceHeaders(deviceToken?: string) {
  if (!deviceToken) return undefined;
  return {
    'X-Device-Token': deviceToken,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainRecord(value) && isPlainRecord(merged[key])) {
      merged[key] = deepMergeRecords(merged[key] as Record<string, unknown>, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function hasObjectKeys(value: unknown): value is Record<string, unknown> {
  return isPlainRecord(value) && Object.keys(value).length > 0;
}

async function getDisplayConfigFallback(id: string): Promise<DeviceDisplayConfigResponse> {
  const [{ data: device }, schedule, settings] = await Promise.all([
    api.get<Device>(`/devices/${id}`),
    scheduleApi.getSchedule(),
    settingsApi.getSettings(),
  ]);

  const overrides = device.overrides;
  const hasScheduleOverride = hasObjectKeys(overrides?.schedule);
  const hasSettingsOverride = hasObjectKeys(overrides?.settings);
  const useOverrides = device.mode === 'override';

  const effectiveSchedule = useOverrides && hasScheduleOverride
    ? (overrides!.schedule as Schedule)
    : schedule;

  const effectiveSettings = useOverrides && hasSettingsOverride
    ? deepMergeRecords(
        settings as unknown as Record<string, unknown>,
        overrides!.settings as unknown as Record<string, unknown>
      ) as unknown as Settings
    : settings;

  return {
    deviceId: device.id,
    mode: device.mode,
    hasScheduleOverride,
    hasSettingsOverride,
    schedule: effectiveSchedule,
    settings: effectiveSettings,
  };
}

// Schedule API
export const scheduleApi = {
  // Get current schedule
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

  // Save schedule
  saveSchedule: async (schedule: Schedule): Promise<SaveVersionedResponse> => {
    const { data } = await api.post<SaveVersionedResponse>('/schedule', schedule);
    return data;
  },

  // Get schedule history
  getHistory: async (limit = 10): Promise<ScheduleHistoryItem[]> => {
    const { data } = await api.get<ScheduleHistoryItem[]>('/schedule/history', { params: { limit, details: 'true' } });
    return data;
  },
};

// Settings API
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

// Devices API
export const devicesApi = {
  // Get all devices
  getDevices: async (): Promise<Device[]> => {
    const { data } = await api.get('/devices');
    return data;
  },

  // Get single device
  getDevice: async (id: string): Promise<Device> => {
    const { data } = await api.get(`/devices/${id}`);
    return data;
  },

  // Create new device (pairing)
  createDevice: async (device: CreateDeviceRequest): Promise<Device> => {
    const { data } = await api.post('/devices', device);
    return data;
  },

  // Update device
  updateDevice: async (id: string, updates: UpdateDeviceRequest): Promise<Device> => {
    const { data } = await api.patch(`/devices/${id}`, updates);
    return data;
  },

  // Delete device
  deleteDevice: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/devices/${id}`);
    return data;
  },

  // Send heartbeat (device pings this)
  sendHeartbeat: async (id: string, deviceToken?: string): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(
      `/devices/${id}/heartbeat`,
      undefined,
      { headers: getDeviceHeaders(deviceToken) },
    );
    return data;
  },

  // Send control command (reload, restart, clear-cache)
  sendCommand: async (id: string, command: DeviceControlCommand): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/control`, command);
    return data;
  },

  // Set device overrides
  setOverrides: async (id: string, overrides: DeviceOverridesPayload): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/overrides`, overrides);
    return data;
  },

  // Clear device overrides
  clearOverrides: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/devices/${id}/overrides`);
    return data;
  },

  // Get effective device display configuration (global + device overrides)
  getDisplayConfig: async (id: string, deviceToken?: string): Promise<DeviceDisplayConfigResponse> => {
    try {
      const { data } = await api.get<DeviceDisplayConfigResponse>(
        `/devices/${id}/display-config`,
        { headers: getDeviceHeaders(deviceToken) },
      );
      return data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 404) throw error;

      // Compatibility fallback for older backends without /display-config endpoint.
      if (!hasWarnedDisplayConfigFallback) {
        // eslint-disable-next-line no-console
        console.warn('[api] /devices/:id/display-config returned 404, using client-side fallback merge');
        hasWarnedDisplayConfigFallback = true;
      }
      return getDisplayConfigFallback(id);
    }
  },
};

// Media API
export const mediaApi = {
  // Get all media
  getMedia: async (filter?: MediaFilter): Promise<Media[]> => {
    const params = new URLSearchParams();
    params.append('limit', '500');
    if (filter?.type) params.append('type', filter.type);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.tag) params.append('tag', filter.tag);

    const { data } = await api.get('/media', { params });
    return data;
  },

  // Get all distinct media tags
  getTags: async (): Promise<string[]> => {
    const { data } = await api.get<string[]>('/media/tags');
    return data;
  },

  // Get single media item
  getMediaItem: async (id: string): Promise<Media> => {
    const { data } = await api.get(`/media/${id}`);
    return data;
  },

  // Upload media file
  uploadMedia: async (file: File): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/media/upload', formData);
    return data;
  },

  // Delete media
  deleteMedia: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/media/${id}`);
    return data;
  },

  // Update media tags
  updateMediaTags: async (id: string, tags: string[]): Promise<Media> => {
    const { data } = await api.patch<Media>(`/media/${id}/tags`, { tags });
    return data;
  },
};

// Custom Palettes API
export interface CustomPalette {
  id: string;
  name: string;
  colors: Partial<ThemeColors>;
  createdAt: string;
  updatedAt: string;
}

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

export const systemApi = {
  getReleases: async (token: string): Promise<SystemReleasesResponse> => {
    const { data } = await api.get<SystemReleasesResponse>('/system/update/status', {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  runUpdate: async (token: string, targetVersion: string): Promise<SystemUpdateRunResponse> => {
    const { data } = await api.post<SystemUpdateRunResponse>('/system/update/run', { targetVersion }, {
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

  importBackup: async (token: string, backupFile: File, replaceMedia = true): Promise<SystemBackupImportResponse> => {
    const formData = new FormData();
    formData.append('backup', backupFile);
    formData.append('replaceMedia', replaceMedia ? 'true' : 'false');

    const { data } = await api.post<SystemBackupImportResponse>('/system/backup/import', formData, {
      headers: getAuthHeaders(token),
    });
    return data;
  },
};

export default api;
