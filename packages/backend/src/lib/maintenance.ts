import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from './prisma.js';
import { BACKUP_DIR, REPO_ROOT, readLocalVersion } from './systemHelpers.js';
import { recordRuntimeStatusSnapshot } from './runtimeHistory.js';
import { UPLOAD_DIR } from './upload.js';

const ONLINE_THRESHOLD_MINUTES = 5;
const STALE_THRESHOLD_MINUTES = 30;
const MAINTENANCE_INTERVAL_MS = 30 * 60 * 1000;
const RUNTIME_HISTORY_INTERVAL_MS = 5 * 60 * 1000;
const ORPHAN_UPLOAD_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const OLD_FILE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAINTENANCE_STALE_THRESHOLD_MS = MAINTENANCE_INTERVAL_MS * 2;
const DISK_WARNING_PERCENT = 85;
const DISK_DANGER_PERCENT = 95;
const LOG_DIR = path.join(REPO_ROOT, 'logs');

export type RuntimeWarningLevel = 'warning' | 'danger';
export type RuntimeWarningCategory = 'disk' | 'devices' | 'media' | 'maintenance';
export type MaintenanceState = 'idle' | 'running' | 'ok' | 'error';

export interface RuntimeWarning {
  id: string;
  level: RuntimeWarningLevel;
  category: RuntimeWarningCategory;
  title: string;
  detail: string;
}

export interface MaintenanceSnapshot {
  state: MaintenanceState;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  deletedExpiredSessions: number;
  removedOrphanUploadFiles: number;
  removedOldBackupFiles: number;
  removedOldLogFiles: number;
  errors: string[];
}

export interface SystemRuntimeStatus {
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
  maintenance: MaintenanceSnapshot;
  warnings: RuntimeWarning[];
}

let maintenanceTimer: NodeJS.Timeout | null = null;
let runtimeHistoryTimer: NodeJS.Timeout | null = null;
let maintenanceRunning = false;
let maintenanceSnapshot: MaintenanceSnapshot = {
  state: 'idle',
  lastRunAt: null,
  lastDurationMs: null,
  deletedExpiredSessions: 0,
  removedOrphanUploadFiles: 0,
  removedOldBackupFiles: 0,
  removedOldLogFiles: 0,
  errors: [],
};

interface FileEntryMeta {
  name: string;
  absolutePath: string;
  size: number;
  mtimeMs: number;
}

function minutesSince(value: Date | null | undefined): number | null {
  if (!value) return null;
  const diffMs = Date.now() - value.getTime();
  return diffMs >= 0 ? diffMs / 60000 : 0;
}

async function listFileMeta(directory: string, filter?: (entry: string) => boolean): Promise<FileEntryMeta[]> {
  if (!existsSync(directory)) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && (!filter || filter(entry.name)));

  return Promise.all(files.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    const stats = await fs.stat(absolutePath);
    return {
      name: entry.name,
      absolutePath,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
    };
  }));
}

async function cleanupExpiredSessions(now: Date): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return result.count;
}

async function cleanupOrphanUploads(now: Date): Promise<number> {
  const mediaRows = await prisma.media.findMany({ select: { filename: true } });
  const referenced = new Set(mediaRows.map((item) => item.filename));
  const uploadFiles = await listFileMeta(UPLOAD_DIR);

  let removed = 0;
  for (const file of uploadFiles) {
    if (referenced.has(file.name)) continue;
    if (now.getTime() - file.mtimeMs < ORPHAN_UPLOAD_MAX_AGE_MS) continue;
    await fs.unlink(file.absolutePath).catch(() => {});
    removed += 1;
  }

  return removed;
}

async function cleanupOldFiles(directory: string, extensionFilter?: string[]): Promise<number> {
  const files = await listFileMeta(directory, (name) => {
    if (!extensionFilter || extensionFilter.length === 0) return true;
    return extensionFilter.some((ext) => name.toLowerCase().endsWith(ext));
  });

  let removed = 0;
  const threshold = Date.now() - OLD_FILE_RETENTION_MS;
  for (const file of files) {
    if (file.mtimeMs > threshold) continue;
    await fs.unlink(file.absolutePath).catch(() => {});
    removed += 1;
  }

  return removed;
}

export async function runMaintenanceCycle(): Promise<MaintenanceSnapshot> {
  if (maintenanceRunning) {
    return { ...maintenanceSnapshot };
  }

  maintenanceRunning = true;
  const startedAt = Date.now();
  const now = new Date();
  const nextSnapshot: MaintenanceSnapshot = {
    ...maintenanceSnapshot,
    state: 'running',
    errors: [],
  };
  maintenanceSnapshot = nextSnapshot;

  try {
    const [deletedExpiredSessions, removedOrphanUploadFiles, removedOldBackupFiles, removedOldLogFiles] = await Promise.all([
      cleanupExpiredSessions(now),
      cleanupOrphanUploads(now),
      cleanupOldFiles(BACKUP_DIR, ['.sql', '.zip']),
      cleanupOldFiles(LOG_DIR, ['.log']),
    ]);

    maintenanceSnapshot = {
      state: 'ok',
      lastRunAt: now.toISOString(),
      lastDurationMs: Date.now() - startedAt,
      deletedExpiredSessions,
      removedOrphanUploadFiles,
      removedOldBackupFiles,
      removedOldLogFiles,
      errors: [],
    };
  } catch (error) {
    maintenanceSnapshot = {
      ...maintenanceSnapshot,
      state: 'error',
      lastRunAt: now.toISOString(),
      lastDurationMs: Date.now() - startedAt,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  } finally {
    maintenanceRunning = false;
  }

  return { ...maintenanceSnapshot };
}

export function startMaintenanceScheduler(): void {
  if (maintenanceTimer) return;
  void runMaintenanceCycle();
  maintenanceTimer = setInterval(() => {
    void runMaintenanceCycle();
  }, MAINTENANCE_INTERVAL_MS);
  maintenanceTimer.unref?.();

  if (!runtimeHistoryTimer) {
    void collectSystemRuntimeStatus().catch((error) => {
      console.error('[runtime] Initial runtime history snapshot failed:', error);
    });
    runtimeHistoryTimer = setInterval(() => {
      void collectSystemRuntimeStatus().catch((error) => {
        console.error('[runtime] Runtime history snapshot failed:', error);
      });
    }, RUNTIME_HISTORY_INTERVAL_MS);
    runtimeHistoryTimer.unref?.();
  }
}

export function stopMaintenanceScheduler(): void {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
  if (runtimeHistoryTimer) {
    clearInterval(runtimeHistoryTimer);
    runtimeHistoryTimer = null;
  }
}

export function getMaintenanceSnapshot(): MaintenanceSnapshot {
  return { ...maintenanceSnapshot };
}

function buildWarnings(runtime: Omit<SystemRuntimeStatus, 'warnings'>): RuntimeWarning[] {
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
    if (Number.isFinite(lastRunAt) && Date.now() - lastRunAt > MAINTENANCE_STALE_THRESHOLD_MS) {
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

export async function collectSystemRuntimeStatus(): Promise<SystemRuntimeStatus> {
  const [version, statFs, deviceRows, mediaRows, uploadFiles, maintenance] = await Promise.all([
    readLocalVersion(),
    fs.statfs(REPO_ROOT),
    prisma.device.findMany({
      select: {
        id: true,
        pairedAt: true,
        lastSeen: true,
      },
    }),
    prisma.media.findMany({
      select: {
        filename: true,
        size: true,
      },
    }),
    listFileMeta(UPLOAD_DIR),
    Promise.resolve(getMaintenanceSnapshot()),
  ]);

  const totalBytes = Number(statFs.blocks) * Number(statFs.bsize);
  const availableBytes = Number(statFs.bavail) * Number(statFs.bsize);
  const usedBytes = Math.max(0, totalBytes - availableBytes);
  const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;

  const pairedDevices = deviceRows.filter((device) => Boolean(device.pairedAt));
  let online = 0;
  let offline = 0;
  let stale = 0;
  let neverSeen = 0;

  pairedDevices.forEach((device) => {
    const ageMinutes = minutesSince(device.lastSeen);
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

  const uploadFileNames = new Set(uploadFiles.map((file) => file.name));
  const missingFiles = mediaRows.filter((item) => !uploadFileNames.has(item.filename)).length;
  const referencedFiles = new Set(mediaRows.map((item) => item.filename));
  const orphanFiles = uploadFiles.filter((file) => !referencedFiles.has(file.name)).length;
  const uploadBytes = uploadFiles.reduce((sum, file) => sum + file.size, 0);

  const baseStatus: Omit<SystemRuntimeStatus, 'warnings'> = {
    ok: true,
    checkedAt: new Date().toISOString(),
    version,
    disk: {
      path: REPO_ROOT,
      totalBytes,
      usedBytes,
      availableBytes,
      usagePercent,
    },
    devices: {
      total: deviceRows.length,
      paired: pairedDevices.length,
      pending: Math.max(deviceRows.length - pairedDevices.length, 0),
      online,
      offline,
      stale,
      neverSeen,
    },
    media: {
      dbCount: mediaRows.length,
      filesOnDisk: uploadFiles.length,
      missingFiles,
      orphanFiles,
      totalBytes: uploadBytes,
    },
    maintenance,
  };

  const runtimeStatus = {
    ...baseStatus,
    warnings: buildWarnings(baseStatus),
  };

  await recordRuntimeStatusSnapshot(runtimeStatus);
  return runtimeStatus;
}
