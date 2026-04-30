import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySlideshowConfig,
  applyEventSlideshows,
  resolveEffectiveSchedule,
  assembleDisplayConfig,
} from './displayConfigPipeline.js';
import { createDefaultSchedule } from '@htmlsignage/shared/schedule';

// ─── applySlideshowConfig ───────────────────────────────────────────────────

test('applySlideshowConfig: device-specific slideshow wins over default', () => {
  const result = applySlideshowConfig(
    { foo: 'bar' },
    { id: 'device-show' },
    { id: 'default-show' },
  );
  assert.deepEqual(result, { foo: 'bar', slideshow: { id: 'device-show' } });
});

test('applySlideshowConfig: falls back to default when no device slideshow', () => {
  const result = applySlideshowConfig(
    { foo: 'bar' },
    null,
    { id: 'default-show' },
  );
  assert.deepEqual(result, { foo: 'bar', slideshow: { id: 'default-show' } });
});

test('applySlideshowConfig: leaves slideshow unset when neither is available', () => {
  const result = applySlideshowConfig({ foo: 'bar' }, null, null);
  assert.deepEqual(result, { foo: 'bar' });
});

test('applySlideshowConfig: does not mutate input settings', () => {
  const input = { foo: 'bar' };
  applySlideshowConfig(input, { id: 'x' }, null);
  assert.deepEqual(input, { foo: 'bar' });
});

// ─── applyEventSlideshows ───────────────────────────────────────────────────

test('applyEventSlideshows: embeds referenced slideshow into event settingsOverrides', () => {
  const settings = {
    events: [
      { id: 'e1', slideshowId: 'show-1', name: 'Event 1' },
      { id: 'e2', slideshowId: 'show-2', name: 'Event 2' },
    ],
  };
  const map = new Map<string, unknown>([['show-1', { id: 'show-1', layout: 'split-view' }]]);

  const result = applyEventSlideshows(settings, map);
  const events = result.events as Array<Record<string, unknown>>;

  assert.deepEqual(events[0]!.settingsOverrides, {
    slideshow: { id: 'show-1', layout: 'split-view' },
  });
  // event 2 references a slideshow that isn't in the map → unchanged
  assert.equal(events[1]!.settingsOverrides, undefined);
});

test('applyEventSlideshows: returns same object when events array missing', () => {
  const settings = { other: 'value' };
  const result = applyEventSlideshows(settings, new Map([['x', {}]]));
  assert.deepEqual(result, settings);
});

test('applyEventSlideshows: returns same object when slideshow map empty', () => {
  const settings = { events: [{ id: 'e1', slideshowId: 'show-1' }] };
  const result = applyEventSlideshows(settings, new Map());
  assert.equal(result, settings);
});

test('applyEventSlideshows: skips events without slideshowId', () => {
  const settings = {
    events: [{ id: 'e1', name: 'No slideshow' }],
  };
  const map = new Map<string, unknown>([['show-1', {}]]);
  const result = applyEventSlideshows(settings, map);
  const events = result.events as Array<Record<string, unknown>>;
  assert.equal(events[0]!.settingsOverrides, undefined);
});

// ─── resolveEffectiveSchedule ───────────────────────────────────────────────

test('resolveEffectiveSchedule: override mode + override schedule → override wins', () => {
  const global = createDefaultSchedule({ version: 1 });
  const override = createDefaultSchedule({ version: 7 });
  const result = resolveEffectiveSchedule('override', global, override);
  assert.equal(result.hasScheduleOverride, true);
  assert.equal(result.schedule.version, 7);
});

test('resolveEffectiveSchedule: auto mode ignores override schedule', () => {
  const global = createDefaultSchedule({ version: 1 });
  const override = createDefaultSchedule({ version: 7 });
  const result = resolveEffectiveSchedule('auto', global, override);
  // Override exists but is ignored — global wins.
  assert.equal(result.hasScheduleOverride, true);
  assert.equal(result.schedule.version, 1);
});

test('resolveEffectiveSchedule: override mode without override falls back to global', () => {
  const global = createDefaultSchedule({ version: 3 });
  const result = resolveEffectiveSchedule('override', global, null);
  assert.equal(result.hasScheduleOverride, false);
  assert.equal(result.schedule.version, 3);
});

// ─── assembleDisplayConfig (end-to-end pure pipeline) ───────────────────────

test('assembleDisplayConfig: full pipeline with device slideshow + event embed + override schedule', () => {
  const global = createDefaultSchedule({ version: 1 });
  const override = createDefaultSchedule({ version: 99 });

  const payload = assembleDisplayConfig({
    deviceId: 'd1',
    mode: 'override',
    maintenanceMode: false,
    globalSchedule: global,
    globalSettings: {
      header: { enabled: true },
      events: [{ id: 'e1', slideshowId: 'show-7', name: 'Sale' }],
    },
    deviceSlideshowConfig: { id: 'show-device' },
    defaultSlideshowConfig: { id: 'show-default' },
    eventSlideshowMap: new Map([['show-7', { id: 'show-7', layout: 'full-rotation' }]]),
    overrideSchedule: override,
  });

  assert.equal(payload.deviceId, 'd1');
  assert.equal(payload.maintenanceMode, false);
  assert.equal(payload.mode, 'override');
  assert.equal(payload.hasScheduleOverride, true);
  assert.equal(payload.schedule.version, 99); // override wins
  assert.deepEqual(payload.settings.slideshow, { id: 'show-device' }); // device wins over default
  const events = payload.settings.events as Array<Record<string, unknown>>;
  assert.deepEqual(events[0]!.settingsOverrides, {
    slideshow: { id: 'show-7', layout: 'full-rotation' },
  });
});

test('assembleDisplayConfig: maintenance flag is preserved untouched by content pipeline', () => {
  const global = createDefaultSchedule();
  const payload = assembleDisplayConfig({
    deviceId: 'd1',
    mode: 'auto',
    maintenanceMode: true,
    globalSchedule: global,
    globalSettings: { header: { enabled: true } },
    deviceSlideshowConfig: null,
    defaultSlideshowConfig: null,
    eventSlideshowMap: new Map(),
    overrideSchedule: null,
  });
  assert.equal(payload.maintenanceMode, true);
});
