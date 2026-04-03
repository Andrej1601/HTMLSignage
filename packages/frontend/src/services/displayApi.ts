import type { PairingResponse } from '@/types/auth.types';
import type { Device } from '@/types/device.types';
import type { Media } from '@/types/media.types';
import { createDefaultSchedule, type Schedule, type ScheduleResponse } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { fetchApi } from './api/core';
import type {
  ApiOkResponse,
  DeviceDisplayConfigResponse,
  DeviceSnapshotUploadResponse,
} from './api/types';

let hasWarnedDisplayConfigFallback = false;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasObjectKeys(value: unknown): boolean {
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function deepMergeRecords<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = deepMergeRecords(
        merged[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      continue;
    }

    merged[key] = value;
  }

  return merged as T;
}

async function getDisplayConfigFallback(id: string): Promise<DeviceDisplayConfigResponse> {
  const [device, schedule, settings] = await Promise.all([
    fetchApi<Device>(`/devices/${id}`),
    displayScheduleApi.getSchedule(),
    displaySettingsApi.getSettings(),
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
        overrides!.settings as unknown as Record<string, unknown>,
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

export const displayScheduleApi = {
  getSchedule: async (): Promise<Schedule> => {
    const data = await fetchApi<ScheduleResponse>('/schedule');

    if (!data || typeof data !== 'object' || !('presets' in data)) {
      const fallbackVersion =
        typeof (data as { version?: unknown } | null)?.version === 'number'
          ? (data as { version: number }).version
          : 1;
      const normalized = createDefaultSchedule();
      normalized.version = fallbackVersion;
      return normalized;
    }

    return data;
  },
};

export const displaySettingsApi = {
  getSettings: async (): Promise<Settings> => fetchApi<Settings>('/settings'),
};

export const displayMediaApi = {
  getMedia: async (): Promise<Media[]> => {
    const params = new URLSearchParams();
    params.set('limit', '500');
    return fetchApi<Media[]>(`/media?${params.toString()}`);
  },
};

export const displayDevicesApi = {
  requestPairing: async (browserId: string): Promise<PairingResponse> =>
    fetchApi<PairingResponse>('/devices/request-pairing', {
      method: 'POST',
      data: { browserId },
    }),

  getDisplayConfig: async (
    id: string,
    deviceToken?: string,
  ): Promise<DeviceDisplayConfigResponse> => {
    try {
      return await fetchApi<DeviceDisplayConfigResponse>(`/devices/${id}/display-config`, {
        deviceToken,
      });
    } catch (error) {
      const status =
        typeof error === 'object' && error && 'status' in error
          ? (error as { status?: number }).status
          : undefined;

      if (status !== 404) throw error;

      if (!hasWarnedDisplayConfigFallback) {
        console.warn(
          '[displayApi] /devices/:id/display-config returned 404, using client-side fallback merge',
        );
        hasWarnedDisplayConfigFallback = true;
      }

      return getDisplayConfigFallback(id);
    }
  },

  sendHeartbeat: async (id: string, deviceToken?: string): Promise<ApiOkResponse> =>
    fetchApi<ApiOkResponse>(`/devices/${id}/heartbeat`, {
      method: 'POST',
      deviceToken,
    }),

  uploadSnapshot: async (
    id: string,
    imageDataUrl: string,
    deviceToken?: string,
  ): Promise<DeviceSnapshotUploadResponse> =>
    fetchApi<DeviceSnapshotUploadResponse>(`/devices/${id}/snapshot`, {
      method: 'POST',
      data: { imageDataUrl },
      deviceToken,
    }),
};
