import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type { SlideshowConfig, SlideshowDefinition } from '@/types/slideshow.types';
import type { SlideshowWorkflowSnapshot } from '@/services/api';
import { migrateSettings } from '@/utils/slideshowMigration';
import { isPlainRecord } from '@/utils/objectUtils';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import { generateDashboardColors, getColorPalette } from '@/types/settings.types';

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

  // Flatten slideshow-level design overrides onto top-level settings so the
  // preview resolves the same designStyle/displayAppearance/colorPalette as
  // `DisplayClientPage.effectiveSettings` does on the live client.
  const merged: Settings = {
    ...globalSettings,
    slideshow: {
      ...editorConfig,
      version: (editorConfig.version || 1) + (isDirty ? 1 : 0),
    },
  };

  if (editorConfig.displayAppearance) {
    merged.displayAppearance = editorConfig.displayAppearance;
  }
  if (editorConfig.designStyle) {
    merged.designStyle = editorConfig.designStyle;
  }
  if (editorConfig.saunaDetailStyle) {
    merged.saunaDetailStyle = editorConfig.saunaDetailStyle;
  }
  if (editorConfig.colorPalette) {
    merged.colorPalette = editorConfig.colorPalette;
    merged.theme = generateDashboardColors(getColorPalette(editorConfig.colorPalette));
  }
  if (editorConfig.header && Object.keys(editorConfig.header).length > 0) {
    merged.header = { ...(merged.header ?? {}), ...editorConfig.header } as typeof merged.header;
  }

  return {
    schedule: previewSchedule,
    settings: migrateSettings(merged),
  };
}

/**
 * Resolve which slideshow should drive a preview. Prefers an explicit
 * selection, otherwise falls back to the default slideshow, otherwise the
 * first available one. Returns `null` if no slideshows exist.
 */
export function resolvePreviewSlideshow(
  slideshows: SlideshowDefinition[] | undefined,
  explicitId: string | null,
): SlideshowDefinition | null {
  const list = slideshows || [];
  if (explicitId) {
    const selected = list.find((s) => s.id === explicitId);
    if (selected) return selected;
  }
  return list.find((s) => s.isDefault) || list[0] || null;
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
