import { describe, it, expect } from 'vitest';
import {
  parseDeviceId,
  toDeviceTarget,
  normalizePrestartMinutes,
  normalizeEditorConfig,
  isScheduleOverride,
  hasStoredSlideshowOrAudioOverride,
  buildCurrentSlideshowSnapshot,
} from './slideshowPage.utils';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';

describe('parseDeviceId', () => {
  it('extracts device id from device target', () => {
    expect(parseDeviceId('device:abc-123')).toBe('abc-123');
  });

  it('returns null for global target', () => {
    expect(parseDeviceId('global')).toBeNull();
  });
});

describe('toDeviceTarget', () => {
  it('creates a device target string', () => {
    expect(toDeviceTarget('abc-123')).toBe('device:abc-123');
  });
});

describe('normalizePrestartMinutes', () => {
  it('passes through valid numbers', () => {
    expect(normalizePrestartMinutes(15)).toBe(15);
  });

  it('clamps to 0-120 range', () => {
    expect(normalizePrestartMinutes(-5)).toBe(0);
    expect(normalizePrestartMinutes(200)).toBe(120);
  });

  it('rounds floats', () => {
    expect(normalizePrestartMinutes(10.7)).toBe(11);
  });

  it('falls back for NaN/undefined', () => {
    expect(normalizePrestartMinutes(undefined)).toBe(10);
    expect(normalizePrestartMinutes(NaN)).toBe(10);
    expect(normalizePrestartMinutes('not-a-number')).toBe(10);
  });

  it('uses custom fallback', () => {
    expect(normalizePrestartMinutes(undefined, 20)).toBe(20);
  });

  it('clamps fallback too', () => {
    expect(normalizePrestartMinutes(undefined, 999)).toBe(120);
  });

  it('parses string numbers', () => {
    expect(normalizePrestartMinutes('25')).toBe(25);
  });
});

describe('normalizeEditorConfig', () => {
  it('returns fallback for non-object input', () => {
    const fallback = createDefaultSlideshowConfig();
    const result = normalizeEditorConfig(null, fallback);
    expect(result).toEqual(fallback);
  });

  it('returns fallback for object without slides array', () => {
    const fallback = createDefaultSlideshowConfig();
    const result = normalizeEditorConfig({ layout: 'grid-2x2' }, fallback);
    expect(result).toEqual(fallback);
  });

  it('merges valid config with fallback', () => {
    const fallback = createDefaultSlideshowConfig();
    const raw = { slides: [{ id: 's1', type: 'media-image' }], layout: 'full-rotation' };
    const result = normalizeEditorConfig(raw, fallback);
    expect(result.layout).toBe('full-rotation');
    expect(result.slides).toEqual(raw.slides);
  });
});

describe('isScheduleOverride', () => {
  it('returns true for valid schedule-like objects', () => {
    expect(isScheduleOverride({ version: 1, presets: {}, autoPlay: true })).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isScheduleOverride(null)).toBe(false);
    expect(isScheduleOverride(undefined)).toBe(false);
  });

  it('returns false for incomplete objects', () => {
    expect(isScheduleOverride({ version: 1 })).toBe(false);
    expect(isScheduleOverride({ presets: {}, autoPlay: true })).toBe(false);
  });
});

describe('hasStoredSlideshowOrAudioOverride', () => {
  it('returns false for null device', () => {
    expect(hasStoredSlideshowOrAudioOverride(null)).toBe(false);
  });

  it('returns false for device with no overrides', () => {
    const device = { overrides: null } as never;
    expect(hasStoredSlideshowOrAudioOverride(device)).toBe(false);
  });
});

describe('buildCurrentSlideshowSnapshot', () => {
  it('returns null when editorConfig is null', () => {
    expect(buildCurrentSlideshowSnapshot({
      editorConfig: null,
      editorPrestartMinutes: 10,
      selectedDevice: null,
      editorAudioOverride: null,
    })).toBeNull();
  });

  it('builds snapshot with config and prestart', () => {
    const config = createDefaultSlideshowConfig();
    const result = buildCurrentSlideshowSnapshot({
      editorConfig: config,
      editorPrestartMinutes: 15,
      selectedDevice: null,
      editorAudioOverride: null,
    });
    expect(result).toEqual({
      config,
      prestartMinutes: 15,
      audioOverride: null,
    });
  });

  it('includes audio override when device is selected', () => {
    const config = createDefaultSlideshowConfig();
    const audio = { enabled: true, source: 'upload' as const };
    const result = buildCurrentSlideshowSnapshot({
      editorConfig: config,
      editorPrestartMinutes: 10,
      selectedDevice: { id: 'dev1' } as never,
      editorAudioOverride: audio as never,
    });
    expect(result?.audioOverride).toEqual(audio);
  });

  it('excludes audio override when no device', () => {
    const config = createDefaultSlideshowConfig();
    const audio = { enabled: true, source: 'upload' as const };
    const result = buildCurrentSlideshowSnapshot({
      editorConfig: config,
      editorPrestartMinutes: 10,
      selectedDevice: null,
      editorAudioOverride: audio as never,
    });
    expect(result?.audioOverride).toBeNull();
  });
});
