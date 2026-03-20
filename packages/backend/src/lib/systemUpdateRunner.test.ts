import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSystemUpdateStatusPayload,
  normalizeSystemUpdateTag,
} from './systemUpdateRunner.js';

test('normalizeSystemUpdateTag keeps tags stable and prefixes plain versions', () => {
  assert.equal(normalizeSystemUpdateTag('2.1.0'), 'v2.1.0');
  assert.equal(normalizeSystemUpdateTag('v2.1.0'), 'v2.1.0');
});

test('buildSystemUpdateStatusPayload derives latest release, dirty state and older releases', () => {
  const payload = buildSystemUpdateStatusPayload({
    currentVersion: '1.9.0',
    releases: [
      { tag: 'v2.0.0', name: '2.0.0', body: '', publishedAt: '', prerelease: false },
      { tag: 'v1.8.0', name: '1.8.0', body: '', publishedAt: '', prerelease: false },
      { tag: 'v2.1.0-beta.1', name: '2.1.0-beta.1', body: '', publishedAt: '', prerelease: true },
    ],
    preflight: {
      ready: false,
      blockers: ['Lokale, tracked Aenderungen blockieren das Update.'],
      warnings: [],
      checks: [
        {
          id: 'working-tree',
          label: 'Arbeitsbaum',
          status: 'error',
          detail: 'Lokale, tracked Aenderungen blockieren das Update.',
        },
      ],
    },
    activeJob: null,
  });

  assert.equal(payload.latestRelease?.tag, 'v2.0.0');
  assert.equal(payload.hasUpdate, true);
  assert.equal(payload.isDirty, true);
  assert.deepEqual(payload.olderReleases.map((release) => release.tag), ['v1.8.0']);
  assert.equal(payload.isRunning, false);
});
