import { prisma } from './prisma.js';

export type RuntimeHistoryMaintenanceState = 'idle' | 'running' | 'ok' | 'error';
export type RuntimeHistoryWarningCategory = 'disk' | 'devices' | 'media' | 'maintenance';

const MAX_HISTORY_POINTS = 7 * 24 * 12;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;

export interface RuntimeHistoryStatusSource {
  checkedAt: string;
  disk: {
    usagePercent: number;
  };
  devices: {
    paired: number;
    online: number;
    offline: number;
    stale: number;
    neverSeen: number;
  };
  media: {
    missingFiles: number;
    orphanFiles: number;
  };
  maintenance: {
    state: RuntimeHistoryMaintenanceState;
  };
  warnings: Array<{ id: string; category?: RuntimeHistoryWarningCategory }>;
}

export interface RuntimeHistoryPoint {
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
  maintenanceState: RuntimeHistoryMaintenanceState;
}

export interface RuntimeHistoryDeltaSummary {
  diskUsagePercent: number;
  onlineDevices: number;
  staleDevices: number;
  warningCount: number;
  systemWarningCount: number;
}

export interface RuntimeHistorySummary {
  sampleCount: number;
  firstPointAt: string | null;
  lastPointAt: string | null;
  coverageHours: number;
  maxDiskUsagePercent: number;
  maxStaleDevices: number;
  maxWarningCount: number;
  maxSystemWarningCount: number;
  avgOnlineDevices: number;
  deltas: RuntimeHistoryDeltaSummary;
}

export interface RuntimeHistoryResponse {
  ok: true;
  periodHours: number;
  points: RuntimeHistoryPoint[];
  summary: RuntimeHistorySummary;
}

let runtimeHistoryWriteChain: Promise<void> = Promise.resolve();

function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function clampCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function normalizeRuntimeHistoryPoint(point: RuntimeHistoryPoint): RuntimeHistoryPoint {
  const deviceWarningCount = clampCount(
    typeof point.deviceWarningCount === 'number'
      ? point.deviceWarningCount
      : deriveLegacyDeviceWarningCount(point),
  );
  const systemWarningCount = clampCount(
    typeof point.systemWarningCount === 'number'
      ? point.systemWarningCount
      : Math.max(point.warningCount - deviceWarningCount, 0),
  );

  return {
    timestamp: point.timestamp,
    diskUsagePercent: clampPercent(point.diskUsagePercent),
    pairedDevices: clampCount(point.pairedDevices),
    onlineDevices: clampCount(point.onlineDevices),
    offlineDevices: clampCount(point.offlineDevices),
    staleDevices: clampCount(point.staleDevices),
    neverSeenDevices: clampCount(point.neverSeenDevices),
    missingMediaFiles: clampCount(point.missingMediaFiles),
    orphanMediaFiles: clampCount(point.orphanMediaFiles),
    warningCount: clampCount(point.warningCount),
    deviceWarningCount,
    systemWarningCount,
    maintenanceState: point.maintenanceState,
  };
}

function deriveLegacyDeviceWarningCount(point: Pick<RuntimeHistoryPoint, 'neverSeenDevices' | 'offlineDevices' | 'staleDevices'>): number {
  let count = 0;
  if (point.neverSeenDevices > 0) count += 1;
  if (point.staleDevices > 0) count += 1;
  else if (point.offlineDevices > 0) count += 1;
  return count;
}

function parseIso(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function mapPrismaHistory(raw: {
  id: string;
  timestamp: Date;
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
  maintenanceState: string;
}): RuntimeHistoryPoint {
  return normalizeRuntimeHistoryPoint({
    timestamp: raw.timestamp.toISOString(),
    diskUsagePercent: raw.diskUsagePercent,
    pairedDevices: raw.pairedDevices,
    onlineDevices: raw.onlineDevices,
    offlineDevices: raw.offlineDevices,
    staleDevices: raw.staleDevices,
    neverSeenDevices: raw.neverSeenDevices,
    missingMediaFiles: raw.missingMediaFiles,
    orphanMediaFiles: raw.orphanMediaFiles,
    warningCount: raw.warningCount,
    deviceWarningCount: raw.deviceWarningCount,
    systemWarningCount: raw.systemWarningCount,
    maintenanceState: raw.maintenanceState as RuntimeHistoryMaintenanceState,
  });
}

export function buildRuntimeHistoryPoint(status: RuntimeHistoryStatusSource): RuntimeHistoryPoint {
  const deviceWarningCount = status.warnings.filter((warning) => warning.category === 'devices').length;
  const warningCount = status.warnings.length;
  return normalizeRuntimeHistoryPoint({
    timestamp: status.checkedAt,
    diskUsagePercent: status.disk.usagePercent,
    pairedDevices: status.devices.paired,
    onlineDevices: status.devices.online,
    offlineDevices: status.devices.offline,
    staleDevices: status.devices.stale,
    neverSeenDevices: status.devices.neverSeen,
    missingMediaFiles: status.media.missingFiles,
    orphanMediaFiles: status.media.orphanFiles,
    warningCount,
    deviceWarningCount,
    systemWarningCount: Math.max(warningCount - deviceWarningCount, 0),
    maintenanceState: status.maintenance.state,
  });
}

export function hasRuntimeHistorySignificantChange(
  previous: RuntimeHistoryPoint | null,
  next: RuntimeHistoryPoint,
): boolean {
  if (!previous) return true;
  return (
    previous.diskUsagePercent !== next.diskUsagePercent ||
    previous.onlineDevices !== next.onlineDevices ||
    previous.offlineDevices !== next.offlineDevices ||
    previous.staleDevices !== next.staleDevices ||
    previous.neverSeenDevices !== next.neverSeenDevices ||
    previous.missingMediaFiles !== next.missingMediaFiles ||
    previous.orphanMediaFiles !== next.orphanMediaFiles ||
    previous.warningCount !== next.warningCount ||
    previous.deviceWarningCount !== next.deviceWarningCount ||
    previous.systemWarningCount !== next.systemWarningCount ||
    previous.maintenanceState !== next.maintenanceState
  );
}

export function filterRuntimeHistoryPoints(points: RuntimeHistoryPoint[], periodHours = 24): RuntimeHistoryPoint[] {
  const hours = Math.max(1, Math.min(24 * 7, Math.round(periodHours)));
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return points.filter((point) => {
    const timestamp = parseIso(point.timestamp);
    return timestamp !== null && timestamp >= cutoff;
  });
}

export function summarizeRuntimeHistoryPoints(points: RuntimeHistoryPoint[]): RuntimeHistorySummary {
  if (points.length === 0) {
    return {
      sampleCount: 0,
      firstPointAt: null,
      lastPointAt: null,
      coverageHours: 0,
      maxDiskUsagePercent: 0,
      maxStaleDevices: 0,
      maxWarningCount: 0,
      maxSystemWarningCount: 0,
      avgOnlineDevices: 0,
      deltas: {
        diskUsagePercent: 0,
        onlineDevices: 0,
        staleDevices: 0,
        warningCount: 0,
        systemWarningCount: 0,
      },
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const firstTs = parseIso(first.timestamp);
  const lastTs = parseIso(last.timestamp);
  const totalOnline = points.reduce((sum, point) => sum + point.onlineDevices, 0);

  return {
    sampleCount: points.length,
    firstPointAt: first.timestamp,
    lastPointAt: last.timestamp,
    coverageHours: firstTs !== null && lastTs !== null
      ? Math.max(0, Math.round((((lastTs - firstTs) / 3_600_000) * 10)) / 10)
      : 0,
    maxDiskUsagePercent: Math.max(...points.map((point) => point.diskUsagePercent)),
    maxStaleDevices: Math.max(...points.map((point) => point.staleDevices)),
    maxWarningCount: Math.max(...points.map((point) => point.warningCount)),
    maxSystemWarningCount: Math.max(...points.map((point) => point.systemWarningCount)),
    avgOnlineDevices: Math.round((totalOnline / points.length) * 10) / 10,
    deltas: {
      diskUsagePercent: Math.round((last.diskUsagePercent - first.diskUsagePercent) * 10) / 10,
      onlineDevices: last.onlineDevices - first.onlineDevices,
      staleDevices: last.staleDevices - first.staleDevices,
      warningCount: last.warningCount - first.warningCount,
      systemWarningCount: last.systemWarningCount - first.systemWarningCount,
    },
  };
}

export async function recordRuntimeStatusSnapshot(status: RuntimeHistoryStatusSource): Promise<void> {
  runtimeHistoryWriteChain = runtimeHistoryWriteChain.then(async () => {
    const nextPoint = buildRuntimeHistoryPoint(status);

    const last = await prisma.runtimeHistory.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const lastPoint = last ? mapPrismaHistory(last) : null;
    const lastTimestamp = lastPoint ? parseIso(lastPoint.timestamp) : null;
    const nextTimestamp = parseIso(nextPoint.timestamp);
    const changed = hasRuntimeHistorySignificantChange(lastPoint, nextPoint);

    if (
      lastPoint &&
      lastTimestamp !== null &&
      nextTimestamp !== null &&
      nextTimestamp - lastTimestamp < SNAPSHOT_INTERVAL_MS &&
      !changed
    ) {
      return;
    }

    await prisma.runtimeHistory.create({
      data: {
        diskUsagePercent: nextPoint.diskUsagePercent,
        pairedDevices: nextPoint.pairedDevices,
        onlineDevices: nextPoint.onlineDevices,
        offlineDevices: nextPoint.offlineDevices,
        staleDevices: nextPoint.staleDevices,
        neverSeenDevices: nextPoint.neverSeenDevices,
        missingMediaFiles: nextPoint.missingMediaFiles,
        orphanMediaFiles: nextPoint.orphanMediaFiles,
        warningCount: nextPoint.warningCount,
        deviceWarningCount: nextPoint.deviceWarningCount,
        systemWarningCount: nextPoint.systemWarningCount,
        maintenanceState: nextPoint.maintenanceState,
      },
    });

    // Trim old entries
    const count = await prisma.runtimeHistory.count();
    if (count > MAX_HISTORY_POINTS) {
      const oldest = await prisma.runtimeHistory.findMany({
        orderBy: { timestamp: 'asc' },
        take: count - MAX_HISTORY_POINTS,
        select: { id: true },
      });
      await prisma.runtimeHistory.deleteMany({
        where: { id: { in: oldest.map((o) => o.id) } },
      });
    }
  }).catch((error) => {
    console.error('[runtimeHistory] Failed to record snapshot:', error);
  });

  await runtimeHistoryWriteChain;
}

export async function getRuntimeHistory(periodHours = 24): Promise<RuntimeHistoryResponse> {
  const hours = Math.max(1, Math.min(24 * 7, Math.round(periodHours)));
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const raw = await prisma.runtimeHistory.findMany({
    where: {
      timestamp: { gte: cutoff },
    },
    orderBy: { timestamp: 'asc' },
  });

  const points = raw.map(mapPrismaHistory);

  return {
    ok: true,
    periodHours: hours,
    points,
    summary: summarizeRuntimeHistoryPoints(points),
  };
}
