import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import {
  buildRuntimeWarnings,
  classifyLogFiles,
  selectBackupFilesToRemove,
  selectOldFrontendAssets,
  selectOrphanUploadFiles,
  selectStaleDeviceSnapshotFiles,
  summarizeDeviceRuntime,
  summarizeMediaRuntime,
  type FileEntryMeta,
  type RuntimeWarning,
} from './maintenancePolicy.js';
import { prisma } from './prisma.js';
import { BACKUP_DIR, REPO_ROOT, readLocalVersion } from './systemHelpers.js';
import { recordRuntimeStatusSnapshot } from './runtimeHistory.js';
import { UPLOAD_DIR } from './upload.js';
import { DEVICE_SNAPSHOT_DIR } from './deviceSnapshots.js';

const MAINTENANCE_INTERVAL_MS = 30 * 60 * 1000;
const RUNTIME_HISTORY_INTERVAL_MS = 5 * 60 * 1000;
const AUDIT_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LOG_TAIL_LINE_COUNT = 2_000;
const LOG_DIR = path.join(REPO_ROOT, 'logs');
const FRONTEND_DIST_ASSET_DIR = path.join(REPO_ROOT, 'packages', 'frontend', 'dist', 'assets');
export type MaintenanceState = 'idle' | 'running' | 'ok' | 'error';

export interface MaintenanceSnapshot {
  state: MaintenanceState;
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
  removedStaleDeviceSnapshots: 0,
  removedOldBackupFiles: 0,
  removedOldLogFiles: 0,
  trimmedLargeLogFiles: 0,
  removedExpiredAuditLogs: 0,
  errors: [],
};

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
  const uploadFiles = await listFileMeta(UPLOAD_DIR);
  const removableFiles = selectOrphanUploadFiles(
    uploadFiles,
    new Set(mediaRows.map((item) => item.filename)),
    now.getTime(),
  );

  let removed = 0;
  for (const file of removableFiles) {
    try {
      await fs.unlink(file.absolutePath);
      removed += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        removed += 1; // Already gone — count as removed
      } else {
        console.error(`[maintenance] Failed to delete orphan upload ${file.name}:`, error);
      }
    }
  }

  return removed;
}

async function cleanupDeviceSnapshots(now: Date): Promise<number> {
  const snapshotFiles = await listFileMeta(DEVICE_SNAPSHOT_DIR, (name) => name.toLowerCase().endsWith('.jpg'));
  if (snapshotFiles.length === 0) return 0;

  const devices = await prisma.device.findMany({
    select: {
      id: true,
      lastSeen: true,
    },
  });
  const removableFiles = selectStaleDeviceSnapshotFiles(
    snapshotFiles,
    new Map(devices.map((device) => [device.id, device])),
    now.getTime(),
  );

  let removed = 0;
  for (const file of removableFiles) {
    try {
      await fs.unlink(file.absolutePath);
      removed += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        removed += 1;
      } else {
        console.error(`[maintenance] Failed to delete stale snapshot ${file.name}:`, error);
      }
    }
  }

  return removed;
}

async function cleanupAuditLogs(now: Date): Promise<number> {
  const result = await prisma.auditLog.deleteMany({
    where: {
      timestamp: {
        lt: new Date(now.getTime() - AUDIT_LOG_RETENTION_MS),
      },
    },
  });
  return result.count;
}

async function cleanupBackupFiles(now: Date): Promise<number> {
  const files = await listFileMeta(BACKUP_DIR, (name) => (
    name.toLowerCase().endsWith('.sql') || name.toLowerCase().endsWith('.zip')
  ));
  if (files.length === 0) return 0;
  const removableFiles = selectBackupFilesToRemove(files, now.getTime());
  let removed = 0;

  for (const file of removableFiles) {
    try {
      await fs.unlink(file.absolutePath);
      removed += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        removed += 1;
      } else {
        console.error(`[maintenance] Failed to delete backup ${file.name}:`, error);
      }
    }
  }

  return removed;
}

async function cleanupLogFiles(now: Date): Promise<{ removed: number; trimmed: number }> {
  const logFiles = await listFileMeta(LOG_DIR, (name) => name.toLowerCase().endsWith('.log'));
  const { removable, trimmable } = classifyLogFiles(logFiles, now.getTime());
  let removed = 0;
  let trimmed = 0;

  for (const file of removable) {
    try {
      await fs.unlink(file.absolutePath);
      removed += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        removed += 1;
      } else {
        console.error(`[maintenance] Failed to delete log ${file.name}:`, error);
      }
    }
  }

  for (const file of trimmable) {
    const raw = await fs.readFile(file.absolutePath, 'utf-8').catch(() => null);
    if (raw === null) continue;

    const nextContent = raw
      .split(/\r?\n/)
      .slice(-LOG_TAIL_LINE_COUNT)
      .join('\n')
      .trimStart();
    const tempFile = `${file.absolutePath}.tmp`;
    await fs.writeFile(tempFile, `${nextContent}\n`, 'utf-8');
    await fs.rename(tempFile, file.absolutePath);
    trimmed += 1;
  }

  return { removed, trimmed };
}

async function cleanupOldFrontendAssets(now: Date): Promise<number> {
  const assetFiles = await listFileMeta(FRONTEND_DIST_ASSET_DIR, (name) => (
    name.toLowerCase().endsWith('.js') ||
    name.toLowerCase().endsWith('.css')
  ));
  if (assetFiles.length === 0) return 0;
  const removableFiles = selectOldFrontendAssets(assetFiles, now.getTime());
  let removed = 0;

  for (const file of removableFiles) {
    try {
      await fs.unlink(file.absolutePath);
      removed += 1;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        removed += 1;
      } else {
        console.error(`[maintenance] Failed to delete old frontend asset ${file.name}:`, error);
      }
    }
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
    const [
      deletedExpiredSessions,
      removedOrphanUploadFiles,
      removedStaleDeviceSnapshots,
      removedOldBackupFiles,
      removedExpiredAuditLogs,
      logCleanup,
      _removedOldFrontendAssets,
    ] = await Promise.all([
      cleanupExpiredSessions(now),
      cleanupOrphanUploads(now),
      cleanupDeviceSnapshots(now),
      cleanupBackupFiles(now),
      cleanupAuditLogs(now),
      cleanupLogFiles(now),
      cleanupOldFrontendAssets(now),
    ]);

    maintenanceSnapshot = {
      state: 'ok',
      lastRunAt: now.toISOString(),
      lastDurationMs: Date.now() - startedAt,
      deletedExpiredSessions,
      removedOrphanUploadFiles,
      removedStaleDeviceSnapshots,
      removedOldBackupFiles,
      removedOldLogFiles: logCleanup.removed,
      trimmedLargeLogFiles: logCleanup.trimmed,
      removedExpiredAuditLogs,
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

  const deviceSummary = summarizeDeviceRuntime(deviceRows);
  const mediaSummary = summarizeMediaRuntime(mediaRows, uploadFiles);

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
      paired: deviceSummary.paired,
      pending: Math.max(deviceRows.length - deviceSummary.paired, 0),
      online: deviceSummary.online,
      offline: deviceSummary.offline,
      stale: deviceSummary.stale,
      neverSeen: deviceSummary.neverSeen,
    },
    media: {
      dbCount: mediaRows.length,
      filesOnDisk: uploadFiles.length,
      missingFiles: mediaSummary.missingFiles,
      orphanFiles: mediaSummary.orphanFiles,
      totalBytes: mediaSummary.totalBytes,
    },
    maintenance,
  };

  const runtimeStatus = {
    ...baseStatus,
    warnings: buildRuntimeWarnings(baseStatus),
  };

  await recordRuntimeStatusSnapshot(runtimeStatus);
  return runtimeStatus;
}
