const ONLINE_THRESHOLD_MINUTES = 5;
const STALE_THRESHOLD_MINUTES = 30;
const ORPHAN_UPLOAD_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DEVICE_SNAPSHOT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const OLD_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FRONTEND_ASSET_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const BACKUP_KEEP_COUNT = 7;
const BACKUP_TOTAL_BUDGET_BYTES = 1_024 * 1_024 * 1_024;
const LOG_MAX_FILE_BYTES = 2 * 1_024 * 1_024;
const MAINTENANCE_INTERVAL_MS = 30 * 60 * 1000;
const MAINTENANCE_STALE_THRESHOLD_MS = MAINTENANCE_INTERVAL_MS * 2;
const DISK_WARNING_PERCENT = 85;
const DISK_DANGER_PERCENT = 95;

export type RuntimeWarningLevel = 'warning' | 'danger';
export type RuntimeWarningCategory = 'disk' | 'devices' | 'media' | 'maintenance';

export interface RuntimeWarning {
  id: string;
  level: RuntimeWarningLevel;
  category: RuntimeWarningCategory;
  title: string;
  detail: string;
}

export interface FileEntryMeta {
  name: string;
  absolutePath: string;
  size: number;
  mtimeMs: number;
}

export interface MaintenanceDeviceState {
  id: string;
  lastSeen: Date | null;
}

export interface DeviceRuntimeRow {
  pairedAt: Date | null;
  lastSeen: Date | null;
}

export interface MediaRuntimeRow {
  filename: string;
  size: number;
}

export interface MaintenanceWarningSource {
  disk: {
    path: string;
    usagePercent: number;
  };
  devices: {
    offline: number;
    stale: number;
    neverSeen: number;
  };
  media: {
    missingFiles: number;
    orphanFiles: number;
  };
  maintenance: {
    errors: string[];
    lastRunAt: string | null;
  };
}

export function minutesSince(value: Date | null | undefined, nowMs = Date.now()): number | null {
  if (!value) return null;
  const diffMs = nowMs - value.getTime();
  return diffMs >= 0 ? diffMs / 60000 : 0;
}

export function selectOrphanUploadFiles(
  uploadFiles: FileEntryMeta[],
  referencedFilenames: Set<string>,
  nowMs: number,
): FileEntryMeta[] {
  return uploadFiles.filter((file) => (
    !referencedFilenames.has(file.name) &&
    nowMs - file.mtimeMs >= ORPHAN_UPLOAD_MAX_AGE_MS
  ));
}

export function selectStaleDeviceSnapshotFiles(
  snapshotFiles: FileEntryMeta[],
  devicesById: Map<string, MaintenanceDeviceState>,
  nowMs: number,
): FileEntryMeta[] {
  return snapshotFiles.filter((file) => {
    const deviceId = file.name.replace(/\.[^.]+$/, '');
    const device = devicesById.get(deviceId);
    const snapshotAgeMs = nowMs - file.mtimeMs;
    const lastSeenAgeMs = device?.lastSeen
      ? nowMs - device.lastSeen.getTime()
      : Number.POSITIVE_INFINITY;

    return !device || (
      snapshotAgeMs >= DEVICE_SNAPSHOT_RETENTION_MS &&
      lastSeenAgeMs >= DEVICE_SNAPSHOT_RETENTION_MS
    );
  });
}

export function selectBackupFilesToRemove(files: FileEntryMeta[], nowMs: number): FileEntryMeta[] {
  const threshold = nowMs - OLD_FILE_RETENTION_MS;
  const sortedFiles = [...files].sort((left, right) => right.mtimeMs - left.mtimeMs);
  const removable: FileEntryMeta[] = [];
  let keptCount = 0;
  let keptBytes = 0;

  for (const file of sortedFiles) {
    const expired = file.mtimeMs <= threshold;
    const exceedsCountBudget = keptCount >= BACKUP_KEEP_COUNT;
    const exceedsSizeBudget = keptCount > 0 && keptBytes + file.size > BACKUP_TOTAL_BUDGET_BYTES;

    if (expired || exceedsCountBudget || exceedsSizeBudget) {
      removable.push(file);
      continue;
    }

    keptCount += 1;
    keptBytes += file.size;
  }

  return removable;
}

export function classifyLogFiles(
  logFiles: FileEntryMeta[],
  nowMs: number,
): { removable: FileEntryMeta[]; trimmable: FileEntryMeta[] } {
  const threshold = nowMs - OLD_FILE_RETENTION_MS;
  const removable: FileEntryMeta[] = [];
  const trimmable: FileEntryMeta[] = [];

  for (const file of logFiles) {
    if (file.mtimeMs <= threshold) {
      removable.push(file);
      continue;
    }
    if (file.size > LOG_MAX_FILE_BYTES) {
      trimmable.push(file);
    }
  }

  return { removable, trimmable };
}

export function selectOldFrontendAssets(files: FileEntryMeta[], nowMs: number): FileEntryMeta[] {
  const threshold = nowMs - FRONTEND_ASSET_RETENTION_MS;
  return files.filter((file) => file.mtimeMs <= threshold);
}

export function summarizeDeviceRuntime(rows: DeviceRuntimeRow[], nowMs = Date.now()): {
  paired: number;
  online: number;
  offline: number;
  stale: number;
  neverSeen: number;
} {
  const pairedDevices = rows.filter((device) => Boolean(device.pairedAt));
  let online = 0;
  let offline = 0;
  let stale = 0;
  let neverSeen = 0;

  pairedDevices.forEach((device) => {
    const ageMinutes = minutesSince(device.lastSeen, nowMs);
    if (ageMinutes === null) {
      neverSeen += 1;
      return;
    }
    if (ageMinutes < ONLINE_THRESHOLD_MINUTES) {
      online += 1;
      return;
    }
    if (ageMinutes < STALE_THRESHOLD_MINUTES) {
      offline += 1;
      return;
    }
    stale += 1;
  });

  return {
    paired: pairedDevices.length,
    online,
    offline,
    stale,
    neverSeen,
  };
}

export function summarizeMediaRuntime(
  mediaRows: MediaRuntimeRow[],
  uploadFiles: FileEntryMeta[],
): {
  missingFiles: number;
  orphanFiles: number;
  totalBytes: number;
} {
  const uploadFileNames = new Set(uploadFiles.map((file) => file.name));
  const missingFiles = mediaRows.filter((item) => !uploadFileNames.has(item.filename)).length;
  const referencedFiles = new Set(mediaRows.map((item) => item.filename));
  const orphanFiles = uploadFiles.filter((file) => !referencedFiles.has(file.name)).length;
  const totalBytes = uploadFiles.reduce((sum, file) => sum + file.size, 0);

  return {
    missingFiles,
    orphanFiles,
    totalBytes,
  };
}

export function buildRuntimeWarnings(
  runtime: MaintenanceWarningSource,
  nowMs = Date.now(),
): RuntimeWarning[] {
  const warnings: RuntimeWarning[] = [];

  if (runtime.disk.usagePercent >= DISK_DANGER_PERCENT) {
    warnings.push({
      id: 'disk-danger',
      level: 'danger',
      category: 'disk',
      title: 'Datenträger fast voll',
      detail: `Die Partition bei ${runtime.disk.path} ist zu ${runtime.disk.usagePercent}% belegt.`,
    });
  } else if (runtime.disk.usagePercent >= DISK_WARNING_PERCENT) {
    warnings.push({
      id: 'disk-warning',
      level: 'warning',
      category: 'disk',
      title: 'Datenträgerauslastung erhöht',
      detail: `Die Partition bei ${runtime.disk.path} ist zu ${runtime.disk.usagePercent}% belegt.`,
    });
  }

  if (runtime.devices.neverSeen > 0) {
    warnings.push({
      id: 'devices-never-seen',
      level: 'warning',
      category: 'devices',
      title: 'Geräte ohne Heartbeat',
      detail: `${runtime.devices.neverSeen} gekoppelte Geräte haben noch nie ein Heartbeat gesendet.`,
    });
  }

  if (runtime.devices.stale > 0) {
    warnings.push({
      id: 'devices-stale',
      level: runtime.devices.stale >= 2 ? 'danger' : 'warning',
      category: 'devices',
      title: 'Geräte mit ausbleibenden Heartbeats',
      detail: `${runtime.devices.stale} Geräte haben seit mehr als ${STALE_THRESHOLD_MINUTES} Minuten kein Heartbeat gesendet.`,
    });
  } else if (runtime.devices.offline > 0) {
    warnings.push({
      id: 'devices-offline',
      level: 'warning',
      category: 'devices',
      title: 'Geräte offline',
      detail: `${runtime.devices.offline} Geräte sind seit mehr als ${ONLINE_THRESHOLD_MINUTES} Minuten nicht mehr online.`,
    });
  }

  if (runtime.media.missingFiles > 0) {
    warnings.push({
      id: 'media-missing',
      level: 'warning',
      category: 'media',
      title: 'Medienreferenzen ohne Datei',
      detail: `${runtime.media.missingFiles} Datenbankeinträge verweisen auf fehlende Dateien im Upload-Verzeichnis.`,
    });
  }

  if (runtime.media.orphanFiles > 0) {
    warnings.push({
      id: 'media-orphan',
      level: 'warning',
      category: 'media',
      title: 'Verwaiste Upload-Dateien',
      detail: `${runtime.media.orphanFiles} Dateien liegen ohne Datenbankreferenz im Upload-Verzeichnis.`,
    });
  }

  if (runtime.maintenance.errors.length > 0) {
    warnings.push({
      id: 'maintenance-error',
      level: 'danger',
      category: 'maintenance',
      title: 'Wartungsjob mit Fehlern',
      detail: runtime.maintenance.errors.join(' | '),
    });
  } else if (!runtime.maintenance.lastRunAt) {
    warnings.push({
      id: 'maintenance-pending',
      level: 'warning',
      category: 'maintenance',
      title: 'Wartungsjob noch nicht gelaufen',
      detail: 'Die automatische Bereinigung wurde seit dem Start noch nicht erfolgreich ausgeführt.',
    });
  } else {
    const lastRunAt = new Date(runtime.maintenance.lastRunAt).getTime();
    if (Number.isFinite(lastRunAt) && nowMs - lastRunAt > MAINTENANCE_STALE_THRESHOLD_MS) {
      warnings.push({
        id: 'maintenance-stale',
        level: 'warning',
        category: 'maintenance',
        title: 'Wartungsjob ist überfällig',
        detail: 'Die automatische Bereinigung ist seit längerer Zeit nicht mehr erfolgreich gelaufen.',
      });
    }
  }

  return warnings;
}
