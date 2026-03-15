import { API_URL } from '@/config/env';
import type { PairingResponse } from '@/types/auth.types';
import type { Device } from '@/types/device.types';
import type { Media } from '@/types/media.types';
import { createDefaultSchedule, type Schedule, type ScheduleResponse } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';

const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
const DEVICE_TOKEN_HEADER = 'X-Device-Token';

type DisplayFetchResponseType = 'json' | 'text' | 'blob' | 'void';

interface DisplayFetchOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: BodyInit | null;
  data?: unknown;
  headers?: HeadersInit;
  responseType?: DisplayFetchResponseType;
  timeoutMs?: number;
}

interface ApiOkResponse {
  ok: boolean;
}

interface DeviceDisplayConfigResponse {
  deviceId: string;
  maintenanceMode: boolean;
  mode: 'auto' | 'override';
  hasScheduleOverride: boolean;
  hasSettingsOverride: boolean;
  schedule: Schedule;
  settings: Settings;
}

interface DeviceSnapshotUploadResponse extends ApiOkResponse {
  snapshotUrl: string | null;
  snapshotCapturedAt: string | null;
}

let hasWarnedDisplayConfigFallback = false;

function resolveDisplayApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/api') || path.startsWith('/health')) {
    return `${API_URL}${path}`;
  }

  return `${API_URL}/api${path.startsWith('/') ? path : `/${path}`}`;
}

function buildRequestBody(data: unknown, headers: Headers): BodyInit | undefined {
  if (data === undefined) return undefined;

  if (
    data instanceof FormData ||
    data instanceof URLSearchParams ||
    data instanceof Blob ||
    data instanceof ArrayBuffer ||
    typeof data === 'string'
  ) {
    return data as BodyInit;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return JSON.stringify(data);
}

async function parseResponseBody<T>(
  response: Response,
  responseType: DisplayFetchResponseType,
): Promise<T> {
  if (responseType === 'void') return undefined as T;
  if (responseType === 'blob') return (await response.blob()) as T;
  if (responseType === 'text') return (await response.text()) as T;

  const raw = await response.text();
  return (raw ? JSON.parse(raw) : null) as T;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(raw) as { error?: string; message?: string };
    return parsed.message || parsed.error || `HTTP ${response.status}`;
  } catch {
    return raw;
  }
}

async function displayFetchApi<T = unknown>(
  path: string,
  options: DisplayFetchOptions = {},
): Promise<T> {
  const {
    body,
    data,
    headers,
    responseType = 'json',
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ...init
  } = options;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = new Headers(headers);
  const requestBody = body ?? buildRequestBody(data, requestHeaders);

  try {
    const response = await fetch(resolveDisplayApiUrl(path), {
      ...init,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = new Error(await parseErrorMessage(response)) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return await parseResponseBody<T>(response, responseType);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }

    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function getDeviceHeaders(deviceToken?: string): HeadersInit | undefined {
  return deviceToken
    ? {
        [DEVICE_TOKEN_HEADER]: deviceToken,
      }
    : undefined;
}

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
    displayFetchApi<Device>(`/devices/${id}`),
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
    const data = await displayFetchApi<ScheduleResponse>('/schedule');

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
  getSettings: async (): Promise<Settings> => displayFetchApi<Settings>('/settings'),
};

export const displayMediaApi = {
  getMedia: async (): Promise<Media[]> => {
    const params = new URLSearchParams();
    params.set('limit', '500');
    return displayFetchApi<Media[]>(`/media?${params.toString()}`);
  },
};

export const displayDevicesApi = {
  requestPairing: async (browserId: string): Promise<PairingResponse> =>
    displayFetchApi<PairingResponse>('/devices/request-pairing', {
      method: 'POST',
      data: { browserId },
    }),

  getDisplayConfig: async (
    id: string,
    deviceToken?: string,
  ): Promise<DeviceDisplayConfigResponse> => {
    try {
      return await displayFetchApi<DeviceDisplayConfigResponse>(`/devices/${id}/display-config`, {
        headers: getDeviceHeaders(deviceToken),
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
    displayFetchApi<ApiOkResponse>(`/devices/${id}/heartbeat`, {
      method: 'POST',
      headers: getDeviceHeaders(deviceToken),
    }),

  uploadSnapshot: async (
    id: string,
    imageDataUrl: string,
    deviceToken?: string,
  ): Promise<DeviceSnapshotUploadResponse> =>
    displayFetchApi<DeviceSnapshotUploadResponse>(`/devices/${id}/snapshot`, {
      method: 'POST',
      data: { imageDataUrl },
      headers: getDeviceHeaders(deviceToken),
    }),
};
