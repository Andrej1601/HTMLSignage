import assert from 'node:assert/strict';
import test from 'node:test';
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
} from './maintenancePolicy.js';

function makeFile(name: string, size: number, ageMs: number): FileEntryMeta {
  return {
    name,
    absolutePath: `/tmp/${name}`,
    size,
    mtimeMs: Date.now() - ageMs,
  };
}

test('maintenance policy selects orphan uploads and stale snapshots deterministically', () => {
  const orphanFiles = selectOrphanUploadFiles([
    makeFile('keep.jpg', 100, 2 * 60 * 60 * 1000),
    makeFile('remove.jpg', 100, 8 * 60 * 60 * 1000),
  ], new Set(['keep.jpg']), Date.now());

  assert.deepEqual(orphanFiles.map((file) => file.name), ['remove.jpg']);

  const staleSnapshots = selectStaleDeviceSnapshotFiles([
    makeFile('device-a.jpg', 100, 15 * 24 * 60 * 60 * 1000),
    makeFile('device-b.jpg', 100, 15 * 24 * 60 * 60 * 1000),
  ], new Map([
    ['device-a', { id: 'device-a', lastSeen: new Date() }],
  ]), Date.now());

  assert.deepEqual(staleSnapshots.map((file) => file.name), ['device-b.jpg']);
});

test('maintenance policy classifies backup, log and frontend asset cleanup candidates', () => {
  const oldEnough = 40 * 24 * 60 * 60 * 1000;
  const removableBackups = selectBackupFilesToRemove([
    makeFile('backup-1.sql', 300_000_000, 1_000),
    makeFile('backup-2.sql', 300_000_000, 2_000),
    makeFile('backup-3.sql', 300_000_000, 3_000),
    makeFile('backup-4.sql', 300_000_000, 4_000),
    makeFile('backup-5.sql', 300_000_000, 5_000),
    makeFile('backup-6.sql', 300_000_000, 6_000),
    makeFile('backup-7.sql', 300_000_000, 7_000),
    makeFile('backup-8.sql', 300_000_000, 8_000),
    makeFile('backup-old.sql', 50_000_000, oldEnough),
  ], Date.now());

  assert.ok(removableBackups.some((file) => file.name === 'backup-old.sql'));
  assert.ok(removableBackups.some((file) => file.name === 'backup-8.sql'));

  const logClassification = classifyLogFiles([
    makeFile('recent.log', 100, 1_000),
    makeFile('huge.log', 3 * 1_024 * 1_024, 1_000),
    makeFile('old.log', 100, oldEnough),
  ], Date.now());

  assert.deepEqual(logClassification.removable.map((file) => file.name), ['old.log']);
  assert.deepEqual(logClassification.trimmable.map((file) => file.name), ['huge.log']);

  const oldAssets = selectOldFrontendAssets([
    makeFile('recent.js', 100, 1_000),
    makeFile('stale.js', 100, 15 * 24 * 60 * 60 * 1000),
  ], Date.now());

  assert.deepEqual(oldAssets.map((file) => file.name), ['stale.js']);
});

test('maintenance policy summarizes runtime state and derives warnings', () => {
  const now = Date.now();
  const deviceSummary = summarizeDeviceRuntime([
    { pairedAt: new Date(now - 1_000), lastSeen: new Date(now - 60_000) },
    { pairedAt: new Date(now - 1_000), lastSeen: new Date(now - 10 * 60 * 1000) },
    { pairedAt: new Date(now - 1_000), lastSeen: new Date(now - 45 * 60 * 1000) },
    { pairedAt: new Date(now - 1_000), lastSeen: null },
    { pairedAt: null, lastSeen: null },
  ], now);

  assert.deepEqual(deviceSummary, {
    paired: 4,
    online: 1,
    offline: 1,
    stale: 1,
    neverSeen: 1,
  });

  const mediaSummary = summarizeMediaRuntime(
    [
      { filename: 'a.jpg', size: 1 },
      { filename: 'missing.jpg', size: 1 },
    ],
    [
      makeFile('a.jpg', 50, 1_000),
      makeFile('orphan.jpg', 25, 1_000),
    ],
  );

  assert.deepEqual(mediaSummary, {
    missingFiles: 1,
    orphanFiles: 1,
    totalBytes: 75,
  });

  const warnings = buildRuntimeWarnings({
    disk: {
      path: '/opt/HTMLSignage',
      usagePercent: 91,
    },
    devices: {
      offline: 1,
      stale: 2,
      neverSeen: 1,
    },
    media: {
      missingFiles: 1,
      orphanFiles: 1,
    },
    maintenance: {
      errors: [],
      lastRunAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
  }, now);

  assert.ok(warnings.some((warning) => warning.id === 'disk-warning'));
  assert.ok(warnings.some((warning) => warning.id === 'devices-stale' && warning.level === 'danger'));
  assert.ok(warnings.some((warning) => warning.id === 'media-missing'));
  assert.ok(warnings.some((warning) => warning.id === 'maintenance-stale'));
});
