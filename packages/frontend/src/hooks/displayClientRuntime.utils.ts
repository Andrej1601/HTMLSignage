import type { PairingResponse } from '../types/auth.types';
import type { Media } from '../types/media.types';
import type { Schedule } from '../types/schedule.types';
import { isPlainRecord } from '../utils/objectUtils';

export const DEVICE_TOKEN_STORAGE_KEY = 'device_auth_token';
export const BROWSER_ID_STORAGE_KEY = 'browserId';
export const DISPLAY_CACHED_SCHEDULE_KEY = 'display_cached_schedule';
export const DISPLAY_CACHED_SETTINGS_KEY = 'display_cached_settings';
export const DISPLAY_CACHED_MEDIA_KEY = 'display_cached_media';

export interface PreviewConfigMessage {
  type: string;
  payload?: unknown;
}

export interface ParsedPreviewConfigPayload {
  schedule: Schedule | null;
  settings: Record<string, unknown> | null;
  deviceId: string | null;
  deviceName: string | null;
  previewClock: number | null;
  maintenanceMode: boolean;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function generateDisplayBrowserId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function readDisplayCachedValue<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDisplayCachedValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

export function clearDisplayClientStorage(): void {
  localStorage.removeItem(DISPLAY_CACHED_SCHEDULE_KEY);
  localStorage.removeItem(DISPLAY_CACHED_SETTINGS_KEY);
  localStorage.removeItem(DISPLAY_CACHED_MEDIA_KEY);
}

export function areDisplayMediaListsEqual(left: Media[], right: Media[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  return left.every((item, index) => {
    const other = right[index];
    return (
      item?.id === other?.id &&
      item?.updatedAt === other?.updatedAt &&
      item?.filename === other?.filename
    );
  });
}

export function parsePreviewConfigPayload(payload: unknown): ParsedPreviewConfigPayload | null {
  if (!isPlainRecord(payload)) return null;

  const incomingSchedule = payload.schedule;
  const schedule = (
    isPlainRecord(incomingSchedule) &&
    typeof incomingSchedule.version === 'number' &&
    isPlainRecord(incomingSchedule.presets) &&
    typeof incomingSchedule.autoPlay === 'boolean'
  )
    ? incomingSchedule as unknown as Schedule
    : null;

  const incomingSettings = payload.settings;
  const settings = isPlainRecord(incomingSettings)
    ? incomingSettings
    : null;

  const previewAtRaw = typeof payload.previewAt === 'string' ? payload.previewAt : '';
  const previewAtTimestamp = previewAtRaw ? Date.parse(previewAtRaw) : Number.NaN;

  return {
    schedule,
    settings,
    deviceId: normalizeNonEmptyString(payload.deviceId),
    deviceName: normalizeNonEmptyString(payload.deviceName),
    previewClock: Number.isFinite(previewAtTimestamp) ? previewAtTimestamp : null,
    maintenanceMode: payload.maintenanceMode === true,
  };
}

export function shouldUseFallbackDisplayConfig(input: {
  isPreviewMode: boolean;
  paired: boolean;
  hasLoadedDeviceConfig: boolean;
}): boolean {
  return input.isPreviewMode || !input.paired || !input.hasLoadedDeviceConfig;
}

export function resolveDisplayIdentity(input: {
  isPreviewMode: boolean;
  previewDeviceId: string | null;
  previewDeviceName: string | null;
  pairingInfo: PairingResponse | null;
}): {
  displayDeviceId: string | null;
  displayDeviceName: string | null;
} {
  if (input.isPreviewMode) {
    return {
      displayDeviceId: input.previewDeviceId,
      displayDeviceName: input.previewDeviceName,
    };
  }

  return input.pairingInfo?.paired
    ? {
        displayDeviceId: input.pairingInfo.id,
        displayDeviceName: input.pairingInfo.name || null,
      }
    : {
        displayDeviceId: null,
        displayDeviceName: null,
      };
}
