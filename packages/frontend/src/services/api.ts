import axios from 'axios';
import type { Schedule, ScheduleResponse } from '@/types/schedule.types';
import { createDefaultSchedule } from '@/types/schedule.types';
import type {
  BulkDeviceActionResponse,
  BulkDeviceControlRequest,
  BulkDeviceUpdateRequest,
  CreateDeviceRequest,
  Device,
  DeviceControlCommand,
  UpdateDeviceRequest,
} from '@/types/device.types';
import type { Media, MediaFilter } from '@/types/media.types';
import type { AudioSettings, Settings, ThemeColors } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import { API_URL } from '@/config/env';

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
  maintenanceMode: boolean;
  mode: 'auto' | 'override';
  hasScheduleOverride: boolean;
  hasSettingsOverride: boolean;
  schedule: Schedule;
  settings: Settings;
}

export interface DeviceSnapshotUploadResponse extends ApiOkResponse {
  snapshotUrl: string | null;
  snapshotCapturedAt: string | null;
}

export interface GitHubRelease {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
}

export type SystemUpdateCheckStatus = 'ok' | 'warning' | 'error';

export interface SystemUpdateCheck {
  id: string;
  label: string;
  status: SystemUpdateCheckStatus;
  detail: string;
}

export interface SystemUpdatePreflight {
  ready: boolean;
  checks: SystemUpdateCheck[];
  blockers: string[];
  warnings: string[];
}

export interface SystemUpdateVerification {
  ready: boolean;
  checks: SystemUpdateCheck[];
  manualActions: string[];
}

export interface SystemReleasesResponse extends ApiOkResponse {
  currentVersion: string;
  latestRelease: GitHubRelease | null;
  hasUpdate: boolean;
  olderReleases: GitHubRelease[];
  isDirty: boolean;
  isRunning: boolean;
  activeJob?: SystemJob | null;
  preflight: SystemUpdatePreflight;
  checkedAt: string;
}

export type SystemJobType = 'system-update' | 'backup-import';
export type SystemJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SystemJobProgress {
  stage: string;
  message: string;
  percent?: number;
}

export interface SystemJobErrorInfo {
  code: string;
  message: string;
  requestId?: string | null;
}

export interface SystemJob {
  id: string;
  type: SystemJobType;
  title: string;
  status: SystemJobStatus;
  requestId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: {
    id: string;
    username: string;
    email: string | null;
  } | null;
  progress: SystemJobProgress | null;
  log: string;
  result: Record<string, unknown> | null;
  error: SystemJobErrorInfo | null;
}

export interface SystemJobStartResponse extends ApiOkResponse {
  jobId: string;
  job: SystemJob;
  message: string;
}

export interface SystemJobListResponse extends ApiOkResponse {
  items: SystemJob[];
}

export interface SystemJobDetailResponse extends ApiOkResponse {
  job: SystemJob;
}

export interface SystemBackupImportResponse extends ApiOkResponse {
  importedMedia: number;
  replaceMedia: boolean;
  importedAt: string;
  importedScheduleVersion?: number;
  importedSettingsVersion?: number;
  warnings?: string[];
}

export interface BackupPreviewMediaItem {
  originalName: string;
  filename: string;
  type: string;
  size: number;
  tags: string[];
  willRename: boolean;
  uploadedByMissing: boolean;
}

export interface SystemBackupPreviewResponse extends ApiOkResponse {
  backup: {
    formatVersion: number;
    exportedAt: string;
    appVersion: string | null;
    mediaCount: number;
    checksumValid: boolean;
  };
  current: {
    appVersion: string;
    scheduleVersion: number | null;
    settingsVersion: number | null;
    mediaCount: number;
  };
  importPlan: {
    replaceMedia: boolean;
    importedMedia: number;
    scheduleWillReplace: boolean;
    settingsWillReplace: boolean;
    renamedMediaFiles: number;
  };
  conflicts: {
    mediaIdConflicts: number;
    filenameConflicts: number;
    missingUsers: number;
  };
  previewMedia: BackupPreviewMediaItem[];
  warnings: string[];
}

export interface AuditLogItem {
  id: string;
  action: string;
  resource: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
  user: {
    id: string;
    username: string;
    email: string | null;
  } | null;
}

export interface SystemAuditLogResponse extends ApiOkResponse {
  items: AuditLogItem[];
  nextCursor: string | null;
  unavailable: boolean;
}

export interface SystemRuntimeWarning {
  id: string;
  level: 'warning' | 'danger';
  category: 'disk' | 'devices' | 'media' | 'maintenance';
  title: string;
  detail: string;
}

export interface SystemMaintenanceSnapshot {
  state: 'idle' | 'running' | 'ok' | 'error';
  lastRunAt: string | null;
  lastDurationMs: number | null;
  deletedExpiredSessions: number;
  removedOrphanUploadFiles: number;
  removedOldBackupFiles: number;
  removedOldLogFiles: number;
  errors: string[];
}

export interface SystemRuntimeStatusResponse {
  ok: true;
  checkedAt: string;
  version: string;
  disk: {
    path: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  devices: {
    total: number;
    paired: number;
    pending: number;
    online: number;
    offline: number;
    stale: number;
    neverSeen: number;
  };
  media: {
    dbCount: number;
    filesOnDisk: number;
    missingFiles: number;
    orphanFiles: number;
    totalBytes: number;
  };
  maintenance: SystemMaintenanceSnapshot;
  warnings: SystemRuntimeWarning[];
}

export interface SystemRuntimeHistoryPoint {
  timestamp: string;
  diskUsagePercent: number;
  pairedDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  staleDevices: number;
  neverSeenDevices: number;
  missingMediaFiles: number;
  orphanMediaFiles: number;
  warningCount: number;
  deviceWarningCount: number;
  systemWarningCount: number;
  maintenanceState: 'idle' | 'running' | 'ok' | 'error';
}

export interface SystemRuntimeHistorySummary {
  sampleCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  coverageHours: number;
  maxDiskUsagePercent: number;
  maxStaleDevices: number;
  maxWarningCount: number;
  maxSystemWarningCount: number;
  avgOnlineDevices: number;
  deltas: {
    diskUsagePercent: number;
    onlineDevices: number;
    staleDevices: number;
    warningCount: number;
    systemWarningCount: number;
  };
}

export interface SystemRuntimeHistoryResponse extends ApiOkResponse {
  periodHours: number;
  points: SystemRuntimeHistoryPoint[];
  summary: SystemRuntimeHistorySummary;
}

export type SlideshowWorkflowTargetType = 'global' | 'device';
export type SlideshowWorkflowAction =
  | 'slideshow.draft.save'
  | 'slideshow.draft.discard'
  | 'slideshow.publish'
  | 'slideshow.rollback';

export interface SlideshowWorkflowSnapshot {
  config: SlideshowConfig;
  prestartMinutes: number;
  audioOverride: AudioSettings | null;
}

export interface SlideshowWorkflowEntry {
  id: string;
  action: SlideshowWorkflowAction;
  timestamp: string;
  snapshot: SlideshowWorkflowSnapshot;
  user: {
    id: string;
    username: string;
    email: string | null;
  } | null;
  metadata: {
    settingsVersion: number | null;
    deviceMode: string | null;
    targetName: string | null;
  };
}

export interface SlideshowWorkflowStateResponse extends ApiOkResponse {
  target: {
    targetType: SlideshowWorkflowTargetType;
    targetId: string | null;
    name: string;
  };
  live: {
    updatedAt: string | null;
    settingsVersion: number | null;
    deviceMode: string | null;
    hasStoredOverride: boolean;
    snapshot: SlideshowWorkflowSnapshot | null;
  };
  draft: SlideshowWorkflowEntry | null;
  history: SlideshowWorkflowEntry[];
}

const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

type FetchApiResponseType = 'json' | 'text' | 'blob' | 'void';

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  data?: unknown;
  responseType?: FetchApiResponseType;
  timeoutMs?: number;
  token?: string;
}

const api = axios.create({
  baseURL: '/api',
  timeout: DEFAULT_REQUEST_TIMEOUT_MS,
});

// Attach JWT from localStorage to every request unless already set.
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
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

function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api') || url.startsWith('/health')) return `${API_URL}${url}`;
  return `${API_URL}/api${url.startsWith('/') ? url : `/${url}`}`;
}

function buildFetchBody(data: unknown, headers: Headers): BodyInit | null | undefined {
  if (data === undefined) return undefined;
  if (
    data instanceof FormData
    || data instanceof URLSearchParams
    || data instanceof Blob
    || data instanceof ArrayBuffer
    || typeof data === 'string'
  ) {
    return data as BodyInit;
  }

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return JSON.stringify(data);
}

async function parseResponseBody<T>(response: Response, responseType: FetchApiResponseType): Promise<T> {
  if (responseType === 'void') return undefined as T;
  if (responseType === 'blob') return await response.blob() as T;
  if (responseType === 'text') return await response.text() as T;

  const raw = await response.text();
  return (raw ? JSON.parse(raw) : null) as T;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  if (!raw) return `HTTP ${response.status}`;

  try {
    const parsed = JSON.parse(raw) as { message?: string; error?: string };
    return parsed.message || parsed.error || `HTTP ${response.status}`;
  } catch {
    return raw;
  }
}

export async function fetchApi<T = unknown>(url: string, options: FetchApiOptions = {}): Promise<T> {
  const {
    data,
    body,
    headers,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    responseType = 'json',
    token,
    ...init
  } = options;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders = new Headers(headers);
  const storedToken = token || (
    typeof window !== 'undefined'
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null
  );

  if (storedToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${storedToken}`);
  }

  const requestBody = body ?? buildFetchBody(data, requestHeaders);

  try {
    const response = await fetch(resolveApiUrl(url), {
      ...init,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
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

  // Bulk update devices
  bulkUpdateDevices: async (payload: BulkDeviceUpdateRequest): Promise<BulkDeviceActionResponse> => {
    const { data } = await api.patch<BulkDeviceActionResponse>('/devices/bulk/update', payload);
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

  // Send control command (reload, restart, clear-cache)
  sendCommand: async (id: string, command: DeviceControlCommand): Promise<ApiOkResponse> => {
    const { data } = await api.post<ApiOkResponse>(`/devices/${id}/control`, command);
    return data;
  },

  // Send one command to multiple devices
  bulkSendCommand: async (payload: BulkDeviceControlRequest): Promise<BulkDeviceActionResponse> => {
    const { data } = await api.post<BulkDeviceActionResponse>('/devices/bulk/control', payload);
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

  previewBackupImport: async (token: string, backupFile: File, replaceMedia = true): Promise<SystemBackupPreviewResponse> => {
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

export const slideshowWorkflowApi = {
  getState: async (targetType: SlideshowWorkflowTargetType, targetId?: string): Promise<SlideshowWorkflowStateResponse> => {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    if (targetType === 'device' && targetId) {
      params.set('targetId', targetId);
    }

    return await fetchApi<SlideshowWorkflowStateResponse>(`/slideshow/workflow?${params.toString()}`);
  },

  saveDraft: async (
    targetType: SlideshowWorkflowTargetType,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/draft', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        ...snapshot,
      },
    });
  },

  discardDraft: async (targetType: SlideshowWorkflowTargetType, targetId?: string): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/discard', {
      method: 'POST',
      data: {
        targetType,
        targetId,
      },
    });
  },

  publish: async (
    targetType: SlideshowWorkflowTargetType,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/publish', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        ...snapshot,
      },
    });
  },

  rollback: async (
    targetType: SlideshowWorkflowTargetType,
    sourceHistoryId: string,
    snapshot: SlideshowWorkflowSnapshot,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    return await fetchApi<ApiOkResponse>('/slideshow/workflow/rollback', {
      method: 'POST',
      data: {
        targetType,
        targetId,
        sourceHistoryId,
        snapshot,
      },
    });
  },

  deleteHistoryEntry: async (
    targetType: SlideshowWorkflowTargetType,
    historyId: string,
    targetId?: string,
  ): Promise<ApiOkResponse> => {
    const params = new URLSearchParams();
    params.set('targetType', targetType);
    if (targetType === 'device' && targetId) {
      params.set('targetId', targetId);
    }

    return await fetchApi<ApiOkResponse>(`/slideshow/workflow/history/${historyId}?${params.toString()}`, {
      method: 'DELETE',
    });
  },
};

export default api;
