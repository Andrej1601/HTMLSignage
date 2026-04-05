import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRuntimeHistoryPoint,
  filterRuntimeHistoryPoints,
  summarizeRuntimeHistoryPoints,
  type RuntimeHistoryPoint,
} from './runtimeHistory.js';

function createPoint(overrides: Partial<RuntimeHistoryPoint> = {}): RuntimeHistoryPoint {
  return {
    timestamp: new Date().toISOString(),
    diskUsagePercent: 40,
    pairedDevices: 5,
    onlineDevices: 4,
    offlineDevices: 1,
    staleDevices: 0,
    neverSeenDevices: 0,
    missingMediaFiles: 0,
    orphanMediaFiles: 0,
    warningCount: 1,
    deviceWarningCount: 0,
    systemWarningCount: 1,
    maintenanceState: 'ok',
    ...overrides,
  };
}

test('buildRuntimeHistoryPoint maps runtime status to compact history point', () => {
  const point = buildRuntimeHistoryPoint({
    checkedAt: '2026-03-15T12:00:00.000Z',
    disk: { usagePercent: 47.36 },
    devices: {
      paired: 8,
      online: 6,
      offline: 1,
      stale: 1,
      neverSeen: 0,
    },
    media: {
      missingFiles: 2,
      orphanFiles: 3,
    },
    maintenance: {
      state: 'running',
    },
    warnings: [
      { id: 'disk-warning', category: 'disk' },
      { id: 'devices-stale', category: 'devices' },
    ],
  });

  assert.deepEqual(point, {
    timestamp: '2026-03-15T12:00:00.000Z',
    diskUsagePercent: 47.4,
    pairedDevices: 8,
    onlineDevices: 6,
    offlineDevices: 1,
    staleDevices: 1,
    neverSeenDevices: 0,
    missingMediaFiles: 2,
    orphanMediaFiles: 3,
    warningCount: 2,
    deviceWarningCount: 1,
    systemWarningCount: 1,
    maintenanceState: 'running',
  });
});

test('summarizeRuntimeHistoryPoints computes peaks, averages and deltas', () => {
  const points = [
    createPoint({
      timestamp: '2026-03-15T08:00:00.000Z',
      diskUsagePercent: 40,
      onlineDevices: 5,
      staleDevices: 0,
      warningCount: 1,
      deviceWarningCount: 0,
      systemWarningCount: 1,
    }),
    createPoint({
      timestamp: '2026-03-15T10:00:00.000Z',
      diskUsagePercent: 43,
      onlineDevices: 4,
      staleDevices: 1,
      warningCount: 2,
      deviceWarningCount: 1,
      systemWarningCount: 1,
    }),
    createPoint({
      timestamp: '2026-03-15T12:00:00.000Z',
      diskUsagePercent: 45,
      onlineDevices: 6,
      staleDevices: 2,
      warningCount: 1,
      deviceWarningCount: 1,
      systemWarningCount: 0,
    }),
  ];

  const summary = summarizeRuntimeHistoryPoints(points);

  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.coverageHours, 4);
  assert.equal(summary.maxDiskUsagePercent, 45);
  assert.equal(summary.maxStaleDevices, 2);
  assert.equal(summary.maxWarningCount, 2);
  assert.equal(summary.maxSystemWarningCount, 1);
  assert.equal(summary.avgOnlineDevices, 5);
  assert.deepEqual(summary.deltas, {
    diskUsagePercent: 5,
    onlineDevices: 1,
    staleDevices: 2,
    warningCount: 0,
    systemWarningCount: -1,
  });
});

test('filterRuntimeHistoryPoints keeps only points in the requested period', () => {
  const now = Date.now();
  const points = [
    createPoint({ timestamp: new Date(now - 30 * 60 * 60 * 1000).toISOString() }),
    createPoint({ timestamp: new Date(now - 2 * 60 * 60 * 1000).toISOString() }),
    createPoint({ timestamp: new Date(now - 15 * 60 * 1000).toISOString() }),
  ];

  const filtered = filterRuntimeHistoryPoints(points, 24);

  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((point) => point.timestamp), [
    points[1].timestamp,
    points[2].timestamp,
  ]);
});
