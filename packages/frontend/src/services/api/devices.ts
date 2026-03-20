import axios from 'axios';
import type {
  BulkDeviceActionResponse,
  BulkDeviceControlRequest,
  BulkDeviceUpdateRequest,
  CreateDeviceRequest,
  Device,
  DeviceControlCommand,
  UpdateDeviceRequest,
} from '@/types/device.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { api, getDeviceHeaders } from './core';
import { scheduleApi } from './schedule';
import { settingsApi } from './settings';
import type {
  ApiOkResponse,
  DeviceDisplayConfigResponse,
  DeviceOverridesPayload,
  DeviceSnapshotUploadResponse,
} from './types';

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
    maintenanceMode: Boolean(device.maintenanceMode),
    mode: device.mode,
    hasScheduleOverride,
    hasSettingsOverride,
    schedule: effectiveSchedule,
    settings: effectiveSettings,
  };
}

export const devicesApi = {
  getDevices: async (): Promise<Device[]> => {
    const { data } = await api.get('/devices');
    return data;
  },

  getDevice: async (id: string): Promise<Device> => {
    const { data } = await api.get(`/devices/${id}`);
    return data;
  },

  createDevice: async (device: CreateDeviceRequest): Promise<Device> => {
    const { data } = await api.post('/devices', device);
    return data;
  },

  updateDevice: async (id: string, updates: UpdateDeviceRequest): Promise<Device> => {
    const { data } = await api.patch(`/devices/${id}`, updates);
    return data;
  },

  bulkUpdateDevices: async (payload: BulkDeviceUpdateRequest): Promise<BulkDeviceActionResponse> => {
    const { data } = await api.patch<BulkDeviceActionResponse>('/devices/bulk/update', payload);
    return data;
  },

  deleteDevice: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/devices/${id}`);
    return data;
  },

  sendHeartbeat: async (id: string, deviceToken?: string): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(
      `/devices/${id}/heartbeat`,
      undefined,
      { headers: getDeviceHeaders(deviceToken) },
    );
    return data;
  },

  uploadSnapshot: async (
    id: string,
    imageDataUrl: string,
    deviceToken?: string,
  ): Promise<DeviceSnapshotUploadResponse> => {
    const { data } = await api.post<DeviceSnapshotUploadResponse>(
      `/devices/${id}/snapshot`,
      { imageDataUrl },
      { headers: getDeviceHeaders(deviceToken) },
    );
    return data;
  },

  sendCommand: async (id: string, command: DeviceControlCommand): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/control`, command);
    return data;
  },

  bulkSendCommand: async (payload: BulkDeviceControlRequest): Promise<BulkDeviceActionResponse> => {
    const { data } = await api.post<BulkDeviceActionResponse>('/devices/bulk/control', payload);
    return data;
  },

  setOverrides: async (id: string, overrides: DeviceOverridesPayload): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/overrides`, overrides);
    return data;
  },

  clearOverrides: async (id: string): Promise<ApiOkResponse> => {
    const { data } = await api.delete<ApiOkResponse>(`/devices/${id}/overrides`);
    return data;
  },

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

      if (!hasWarnedDisplayConfigFallback) {
        console.warn('[api] /devices/:id/display-config returned 404, using client-side fallback merge');
        hasWarnedDisplayConfigFallback = true;
      }

      return getDisplayConfigFallback(id);
    }
  },
};
