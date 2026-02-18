import axios from 'axios';
import type { Schedule, ScheduleResponse } from '@/types/schedule.types';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { Device, CreateDeviceRequest, UpdateDeviceRequest, DeviceControlCommand } from '@/types/device.types';
import type { Media, MediaFilter } from '@/types/media.types';
import type { Settings } from '@/types/settings.types';

export interface ApiOkResponse {
  ok: boolean;
}

export interface SaveVersionedResponse extends ApiOkResponse {
  version: number;
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

export interface SystemUpdateStatusResponse extends ApiOkResponse {
  branch: string | null;
  currentCommit: string | null;
  remoteCommit: string | null;
  hasUpdate: boolean;
  isGitRepo: boolean;
  isDirty: boolean;
  isRunning: boolean;
  checkedAt: string;
}

export interface SystemUpdateRunResponse extends ApiOkResponse {
  status: Omit<SystemUpdateStatusResponse, 'ok' | 'checkedAt'>;
  log: string;
  finishedAt: string;
  note?: string;
}

export interface SystemBackupImportResponse extends ApiOkResponse {
  importedMedia: number;
  replaceMedia: boolean;
  importedAt: string;
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let hasWarnedDisplayConfigFallback = false;
const DISPLAY_CONFIG_UNAVAILABLE_STORAGE_KEY = 'htmlsignage_display_config_unavailable';

function readDisplayConfigUnavailableFlag(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(DISPLAY_CONFIG_UNAVAILABLE_STORAGE_KEY);
    if (value === '1') return true;
    if (value === '0') return false;
    return null;
  } catch {
    return null;
  }
}

function writeDisplayConfigUnavailableFlag(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISPLAY_CONFIG_UNAVAILABLE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Ignore storage errors.
  }
}

let isDisplayConfigEndpointUnavailable: boolean | null = readDisplayConfigUnavailableFlag();

function getAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
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
  getHistory: async (limit = 10) => {
    const { data } = await api.get('/schedule/history', { params: { limit } });
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
  sendHeartbeat: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/heartbeat`);
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
  getDisplayConfig: async (id: string): Promise<DeviceDisplayConfigResponse> => {
    if (isDisplayConfigEndpointUnavailable === true) {
      return getDisplayConfigFallback(id);
    }

    try {
      const { data } = await api.get<DeviceDisplayConfigResponse>(`/devices/${id}/display-config`);
      isDisplayConfigEndpointUnavailable = false;
      writeDisplayConfigUnavailableFlag(false);
      return data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 404) throw error;

      // Compatibility fallback for older backends without /display-config endpoint.
      isDisplayConfigEndpointUnavailable = true;
      writeDisplayConfigUnavailableFlag(true);
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
    if (filter?.type) params.append('type', filter.type);
    if (filter?.search) params.append('search', filter.search);

    const { data } = await api.get('/media', { params });
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

    const { data } = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  // Delete media
  deleteMedia: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/media/${id}`);
    return data;
  },
};

export const systemApi = {
  getUpdateStatus: async (token: string): Promise<SystemUpdateStatusResponse> => {
    const { data } = await api.get<SystemUpdateStatusResponse>('/system/update/status', {
      headers: getAuthHeaders(token),
    });
    return data;
  },

  runUpdate: async (token: string): Promise<SystemUpdateRunResponse> => {
    const { data } = await api.post<SystemUpdateRunResponse>('/system/update/run', {}, {
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
      headers: {
        ...getAuthHeaders(token),
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },
};

export default api;
