import type { Schedule } from '@/types/schedule.types';
import type { AudioSettings, Settings, ThemeColors } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';

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
}

export interface DeviceDisplayConfigResponse {
  deviceId: string;
  maintenanceMode: boolean;
  mode: 'auto' | 'override';
  hasScheduleOverride: boolean;
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
  removedStaleDeviceSnapshots: number;
  removedOldBackupFiles: number;
  removedOldLogFiles: number;
  trimmedLargeLogFiles: number;
  removedExpiredAuditLogs: number;
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

export type FetchApiResponseType = 'json' | 'text' | 'blob' | 'void';

export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  data?: unknown;
  responseType?: FetchApiResponseType;
  timeoutMs?: number;
  token?: string;
  deviceToken?: string;
}

export interface CustomPalette {
  id: string;
  name: string;
  colors: Partial<ThemeColors>;
  createdAt: string;
  updatedAt: string;
}
