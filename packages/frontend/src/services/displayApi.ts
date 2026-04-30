import type { PairingResponse } from '@/types/auth.types';
import type { Device } from '@/types/device.types';
import type { Media } from '@/types/media.types';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { ScheduleSchema } from '@htmlsignage/shared/schedule';
import { SettingsSchema } from '@htmlsignage/shared/settings';
import { fetchApi } from './api/core';
import type {
  ApiOkResponse,
  DeviceDisplayConfigResponse,
  DeviceSnapshotUploadResponse,
} from './api/types';

import { isPlainRecord } from '@/utils/objectUtils';

let hasWarnedDisplayConfigFallback = false;

function hasObjectKeys(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length > 0;
}

async function getDisplayConfigFallback(id: string): Promise<DeviceDisplayConfigResponse> {
  const [device, schedule, settings] = await Promise.all([
    fetchApi<Device>(`/devices/${id}`),
    displayScheduleApi.getSchedule(),
    displaySettingsApi.getSettings(),
  ]);

  const overrides = device.overrides;
  const hasScheduleOverride = hasObjectKeys(overrides?.schedule);
  const useOverrides = device.mode === 'override';

  const effectiveSchedule = useOverrides && hasScheduleOverride
    ? (overrides!.schedule as Schedule)
    : schedule;

  return {
    deviceId: device.id,
    maintenanceMode: Boolean(device.maintenanceMode),
    mode: device.mode,
    hasScheduleOverride,
    schedule: effectiveSchedule,
    settings,
  };
}

export const displayScheduleApi = {
  getSchedule: async (): Promise<Schedule> => {
    const data = await fetchApi<unknown>('/schedule');
    const parsed = ScheduleSchema.safeParse(data);
    if (parsed.success) {
      return parsed.data;
    }

    console.warn('[displayScheduleApi] Invalid schedule payload, falling back to default:', parsed.error.issues);
    const fallbackVersion =
      typeof (data as { version?: unknown } | null)?.version === 'number'
        ? (data as { version: number }).version
        : 1;
    const normalized = createDefaultSchedule();
    normalized.version = fallbackVersion;
    return normalized;
  },
};

export const displaySettingsApi = {
  getSettings: async (): Promise<Settings> => {
    const data = await fetchApi<unknown>('/settings');
    const parsed = SettingsSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[displaySettingsApi] Invalid settings payload:', parsed.error.issues);
    }
    return data as Settings;
  },
};

export const displayMediaApi = {
  getMedia: async (deviceToken?: string): Promise<Media[]> => {
    const params = new URLSearchParams();
    params.set('limit', '500');
    return fetchApi<Media[]>(`/media?${params.toString()}`, { deviceToken });
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
