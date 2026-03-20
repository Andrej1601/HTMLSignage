import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBulkDeviceCommandAuditDetails,
  buildBulkDeviceUpdateAuditDetails,
  buildDeviceCreateAuditDetails,
  buildDeviceCreateData,
  buildDeviceDisplayConfigPayload,
  buildDevicePairAuditDetails,
  buildDeviceUpdateAuditDetails,
  buildDeviceUpdateData,
  decodeSnapshotDataUrl,
  findMissingEntityIds,
  generateUniquePairingCode,
  normalizeDeviceGroupName,
  readDeviceFleetState,
} from './deviceManagement.js';

test('normalizeDeviceGroupName trims values and collapses empty strings to null', () => {
  assert.equal(normalizeDeviceGroupName('  Lobby  '), 'Lobby');
  assert.equal(normalizeDeviceGroupName('   '), null);
  assert.equal(normalizeDeviceGroupName(undefined), null);
});

test('readDeviceFleetState extracts normalized group and maintenance mode', () => {
  assert.deepEqual(
    readDeviceFleetState({ groupName: '  Sauna  ', maintenanceMode: true }),
    { groupName: 'Sauna', maintenanceMode: true },
  );
  assert.deepEqual(readDeviceFleetState(null), { groupName: null, maintenanceMode: false });
});

test('decodeSnapshotDataUrl only accepts jpeg data urls', () => {
  const jpeg = 'data:image/jpeg;base64,SGVsbG8=';
  assert.equal(decodeSnapshotDataUrl(jpeg)?.toString('utf8'), 'Hello');
  assert.equal(decodeSnapshotDataUrl('data:image/png;base64,SGVsbG8='), null);
});

test('device update builders normalize group names consistently', () => {
  assert.deepEqual(buildDeviceCreateData({
    name: 'Display A',
    groupName: '  Eingang ',
    maintenanceMode: true,
    mode: 'override',
    pairedAt: new Date('2026-03-20T12:00:00.000Z'),
  }), {
    name: 'Display A',
    groupName: 'Eingang',
    maintenanceMode: true,
    mode: 'override',
    pairedAt: new Date('2026-03-20T12:00:00.000Z'),
  });

  assert.deepEqual(buildDeviceUpdateData({
    name: 'Display B',
    groupName: '   ',
    maintenanceMode: false,
  }), {
    name: 'Display B',
    groupName: null,
    maintenanceMode: false,
  });

  assert.deepEqual(buildDeviceUpdateAuditDetails({
    groupName: '  Wellness ',
    mode: 'auto',
  }), {
    groupName: 'Wellness',
    mode: 'auto',
  });

  assert.deepEqual(buildDeviceCreateAuditDetails({
    name: 'Display C',
    groupName: '  Lobby ',
    maintenanceMode: false,
    mode: 'auto',
  }), {
    name: 'Display C',
    groupName: 'Lobby',
    maintenanceMode: false,
    mode: 'auto',
  });
});

test('device audit detail builders keep bulk and pair payloads consistent', () => {
  assert.deepEqual(buildBulkDeviceUpdateAuditDetails({
    deviceIds: ['device-1', 'device-2'],
    updates: {
      groupName: '  Sauna ',
      maintenanceMode: true,
    },
  }), {
    affectedCount: 2,
    deviceIds: ['device-1', 'device-2'],
    updates: {
      groupName: 'Sauna',
      maintenanceMode: true,
    },
  });

  assert.deepEqual(buildBulkDeviceCommandAuditDetails({
    deviceIds: ['device-1'],
    command: 'restart',
  }), {
    affectedCount: 1,
    deviceIds: ['device-1'],
    command: 'restart',
  });

  assert.deepEqual(buildDevicePairAuditDetails({
    name: 'Display D',
    groupName: '  Eingang ',
  }), {
    name: 'Display D',
    groupName: 'Eingang',
  });
});

test('findMissingEntityIds returns only ids that are not present in the result set', () => {
  assert.deepEqual(
    findMissingEntityIds(['a', 'b', 'c'], [{ id: 'a' }, { id: 'c' }]),
    ['b'],
  );
});

test('buildDeviceDisplayConfigPayload prefers overrides only in override mode', () => {
  const payload = buildDeviceDisplayConfigPayload({
    deviceId: 'device-1',
    mode: 'override',
    maintenanceMode: true,
    globalSchedule: { version: 1 },
    globalSettings: { header: { enabled: true } },
    overrideSchedule: { version: 2 },
    overrideSettings: { display: { compactMode: true } },
  });

  assert.equal(payload.hasScheduleOverride, true);
  assert.equal(payload.hasSettingsOverride, true);
  assert.deepEqual(payload.schedule, { version: 2 });
  assert.equal((payload.settings.header as { enabled?: boolean }).enabled, true);
  assert.deepEqual(payload.settings.display, { compactMode: true });
});

test('generateUniquePairingCode retries deterministic alternatives when a code is taken', async () => {
  const seenCodes: string[] = [];
  const pairingCode = await generateUniquePairingCode('browser-id-123', async (candidate) => {
    seenCodes.push(candidate);
    return seenCodes.length < 2;
  });

  assert.equal(seenCodes.length, 2);
  assert.match(pairingCode, /^\d{6}$/);
  assert.notEqual(seenCodes[0], seenCodes[1]);
});
