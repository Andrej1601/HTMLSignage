import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import {
  buildDeviceWorkflowOverrideSettings,
  buildGlobalSettingsWorkflowPayload,
  buildLiveDeviceWorkflowSnapshot,
  buildLiveGlobalWorkflowSnapshot,
  buildWorkflowActionAuditDetails,
  buildWorkflowHistoryDeleteAuditDetails,
  createWorkflowHistoryEntry,
  getCurrentWorkflowDraftEntry,
  matchesWorkflowTarget,
  normalizeWorkflowSnapshot,
} from './slideshowWorkflow.js';

test('normalizeWorkflowSnapshot clones config and audio overrides safely', () => {
  const raw = {
    config: {
      version: 3,
      layout: 'triple-view',
      slides: [],
    },
    prestartMinutes: 12,
    audioOverride: {
      enabled: true,
      volume: 0.8,
      loop: true,
    },
  };

  const snapshot = normalizeWorkflowSnapshot(raw);
  assert.ok(snapshot);
  assert.notEqual(snapshot?.config, raw.config);
  assert.notEqual(snapshot?.audioOverride, raw.audioOverride);
  assert.equal(snapshot?.prestartMinutes, 12);
});

test('workflow target matching and draft detection respect publish boundaries', () => {
  const logs = [
    {
      action: 'slideshow.draft.save',
      details: {
        targetType: 'device',
        targetId: 'device-1',
        snapshot: {
          config: { version: 1, layout: 'split-view', slides: [] },
          prestartMinutes: 10,
        },
      },
    },
    {
      action: 'slideshow.publish',
      details: {
        targetType: 'device',
        targetId: 'device-1',
      },
    },
  ];

  assert.equal(matchesWorkflowTarget(logs[0].details, 'device', 'device-1'), true);
  assert.equal(matchesWorkflowTarget(logs[0].details, 'device', 'device-2'), false);
  assert.equal(matchesWorkflowTarget(logs[0].details, 'global', null), false);
  assert.equal(getCurrentWorkflowDraftEntry(logs), logs[0]);
  assert.equal(getCurrentWorkflowDraftEntry(logs.slice(1)), null);
});

test('workflow payload builders increment slideshow version and manage audio overrides', () => {
  const snapshot = normalizeWorkflowSnapshot({
    config: {
      version: 9,
      layout: 'full-rotation',
      slides: [],
    },
    prestartMinutes: 18,
    audioOverride: null,
  });

  assert.ok(snapshot);

  const globalPayload = buildGlobalSettingsWorkflowPayload({
    display: { prestartMinutes: 5, showClock: true },
    slideshow: { version: 4, layout: 'old-layout' },
  }, snapshot!);

  assert.deepEqual(globalPayload.display, { prestartMinutes: 18, showClock: true });
  assert.equal((globalPayload.slideshow as { version?: number }).version, 5);

  const devicePayload = buildDeviceWorkflowOverrideSettings({
    display: { prestartMinutes: 6 },
    slideshow: { version: 2 },
    audio: { enabled: true, volume: 0.5 },
  }, snapshot!);

  assert.equal((devicePayload.slideshow as { version?: number }).version, 3);
  assert.equal('audio' in devicePayload, false);
});

test('live snapshot and history helpers produce stable workflow records', () => {
  const liveGlobal = buildLiveGlobalWorkflowSnapshot({
    display: { prestartMinutes: 14 },
    slideshow: { version: 7, layout: 'grid-2x2' },
  });
  const liveDevice = buildLiveDeviceWorkflowSnapshot({
    display: { prestartMinutes: 11 },
    slideshow: { version: 8, layout: 'timeline' },
    audio: { enabled: true, volume: 0.7, loop: true },
  });

  assert.equal(liveGlobal?.prestartMinutes, 14);
  assert.equal(liveDevice?.prestartMinutes, 11);
  assert.deepEqual(liveDevice?.audioOverride, { enabled: true, volume: 0.7, loop: true });

  const historyEntry = createWorkflowHistoryEntry({
    id: 'history-1',
    action: 'slideshow.publish',
    timestamp: new Date('2026-03-20T12:00:00.000Z'),
    user: { id: 'u1', username: 'admin', email: 'admin@example.com' },
    details: buildWorkflowActionAuditDetails({
      targetType: 'device',
      targetId: 'device-1',
      targetName: 'Sauna Display',
      deviceMode: 'override',
      snapshot: liveDevice!,
      settingsVersion: 3,
    }) as Prisma.JsonValue,
  });

  assert.ok(historyEntry);
  assert.equal(historyEntry?.metadata.targetName, 'Sauna Display');
  assert.equal(historyEntry?.metadata.deviceMode, 'override');
  assert.equal(historyEntry?.metadata.settingsVersion, 3);

  const deleted = buildWorkflowHistoryDeleteAuditDetails({
    targetType: 'global',
    deletedAction: 'slideshow.rollback',
    deletedTimestamp: new Date('2026-03-20T13:00:00.000Z'),
    targetName: 'Globale Slideshow',
  }) as { deletedAction?: string; targetName?: string };

  assert.equal(deleted.deletedAction, 'slideshow.rollback');
  assert.equal(deleted.targetName, 'Globale Slideshow');
});
