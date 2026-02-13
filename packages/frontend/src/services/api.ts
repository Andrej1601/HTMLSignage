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

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

let hasWarnedDisplayConfigFallback = false;

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
    try {
      const { data } = await api.get<DeviceDisplayConfigResponse>(`/devices/${id}/display-config`);
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

export default api;
