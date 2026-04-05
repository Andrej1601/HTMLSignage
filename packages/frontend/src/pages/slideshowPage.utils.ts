import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import type { SlideshowWorkflowSnapshot } from '@/services/api';
import { migrateSettings } from '@/utils/slideshowMigration';
import { isPlainRecord } from '@/utils/objectUtils';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';

export function normalizeEditorConfig(raw: unknown, fallback?: SlideshowConfig | null): SlideshowConfig {
  const base = fallback || createDefaultSlideshowConfig();
  if (!isPlainRecord(raw) || !Array.isArray(raw.slides)) {
    return base;
  }

  return {
    ...base,
    ...raw,
    slides: raw.slides as SlideshowConfig['slides'],
  };
}

export function normalizePrestartMinutes(value: unknown, fallback = 10): number {
  const safeFallback = Number.isFinite(fallback) ? Math.min(120, Math.max(0, Math.round(fallback))) : 10;
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.min(120, Math.max(0, Math.round(parsed)));
}

interface PreviewPayloadInput {
  settings: Settings | null | undefined;
  previewSchedule: Schedule;
  editorConfig: SlideshowConfig | null;
  editorPrestartMinutes: number;
  isDirty: boolean;
}

export function buildSlideshowPreviewPayload(input: PreviewPayloadInput): {
  schedule: Schedule;
  settings: Settings;
} | null {
  const { settings, previewSchedule, editorConfig, editorPrestartMinutes, isDirty } = input;

  if (!settings || !editorConfig) return null;

  const globalSettings = migrateSettings({
    ...settings,
    display: {
      ...(settings.display || {}),
      prestartMinutes: editorPrestartMinutes,
    },
  });

  return {
    schedule: previewSchedule,
    settings: migrateSettings({
      ...globalSettings,
      slideshow: {
        ...editorConfig,
        version: (editorConfig.version || 1) + (isDirty ? 1 : 0),
      },
    }),
  };
}

export function buildCurrentSlideshowSnapshot(input: {
  editorConfig: SlideshowConfig | null;
  editorPrestartMinutes: number;
}): SlideshowWorkflowSnapshot | null {
  const { editorConfig, editorPrestartMinutes } = input;

  if (!editorConfig) return null;

  return {
    config: editorConfig,
    prestartMinutes: editorPrestartMinutes,
    audioOverride: null,
  };
}
