import type { Device } from '@/types/device.types';
import type { Schedule } from '@/types/schedule.types';
import type { AudioSettings, Settings } from '@/types/settings.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import type { SlideshowWorkflowSnapshot } from '@/services/api';
import { migrateSettings } from '@/utils/slideshowMigration';
import { deepMergeRecords, isPlainRecord } from '@/utils/objectUtils';
import { getDeviceOverrideSettings, hasDeviceOverrides } from '@/utils/deviceUtils';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';

export type EditorTarget = 'global' | `device:${string}`;

export function isScheduleOverride(value: unknown): value is Schedule {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.version === 'number' &&
    isPlainRecord(value.presets) &&
    typeof value.autoPlay === 'boolean'
  );
}

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

export function getOverrideSlideshowConfig(
  device: Device | null,
  fallback?: SlideshowConfig | null,
): SlideshowConfig | null {
  const settings = getDeviceOverrideSettings(device);
  const raw = settings.slideshow;
  if (!isPlainRecord(raw) || !Array.isArray(raw.slides)) return fallback || null;
  return normalizeEditorConfig(raw, fallback);
}

export function hasStoredSlideshowOrAudioOverride(device: Device | null): boolean {
  const settingsOverride = getDeviceOverrideSettings(device);
  return Boolean(settingsOverride.slideshow) || Boolean(settingsOverride.audio);
}

export function getDeviceSlideshowSource(device: Device): {
  label: string;
  detail: string;
  badgeClass: string;
  usesGlobal: boolean;
} {
  const hasOverrides = hasDeviceOverrides(device);

  if (device.mode === 'override' && hasOverrides) {
    return {
      label: 'Override aktiv',
      detail: 'Dieses Display nutzt eine eigene Slideshow-/Settings-Konfiguration.',
      badgeClass: 'bg-spa-info-light text-spa-info-dark',
      usesGlobal: false,
    };
  }

  if (device.mode === 'override' && !hasOverrides) {
    return {
      label: 'Global (kein Override)',
      detail: 'Modus ist Überschrieben, aber es sind keine Overrides gespeichert.',
      badgeClass: 'bg-spa-warning-light text-spa-warning-dark',
      usesGlobal: true,
    };
  }

  if (device.mode === 'auto' && hasOverrides) {
    return {
      label: 'Global (Override hinterlegt)',
      detail: 'Override ist gespeichert, wird im Modus Automatisch aber nicht verwendet.',
      badgeClass: 'bg-spa-success-light text-spa-success-dark',
      usesGlobal: true,
    };
  }

  return {
    label: 'Global',
    detail: 'Dieses Display nutzt die globale Slideshow aus diesem Reiter.',
    badgeClass: 'bg-spa-success-light text-spa-success-dark',
    usesGlobal: true,
  };
}

export function summarizeDeviceSlideshowSources(devices: Device[]) {
  const summary = {
    global: 0,
    overrideActive: 0,
    overrideStoredInactive: 0,
    overrideModeWithoutData: 0,
  };

  for (const device of devices) {
    const source = getDeviceSlideshowSource(device);
    if (!source.usesGlobal && source.label === 'Override aktiv') {
      summary.overrideActive += 1;
      continue;
    }
    if (source.label === 'Global (Override hinterlegt)') {
      summary.overrideStoredInactive += 1;
      continue;
    }
    if (source.label === 'Global (kein Override)') {
      summary.overrideModeWithoutData += 1;
      continue;
    }
    summary.global += 1;
  }

  return summary;
}

export function toDeviceTarget(deviceId: string): EditorTarget {
  return `device:${deviceId}`;
}

export function parseDeviceId(target: EditorTarget): string | null {
  return target.startsWith('device:') ? target.slice('device:'.length) : null;
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
  selectedDevice: Device | null;
  editorAudioOverride: AudioSettings | null;
}

export function buildSlideshowPreviewPayload(input: PreviewPayloadInput): {
  schedule: Schedule;
  settings: Settings;
} | null {
  const {
    settings,
    previewSchedule,
    editorConfig,
    editorPrestartMinutes,
    isDirty,
    selectedDevice,
    editorAudioOverride,
  } = input;

  if (!settings || !editorConfig) return null;

  const globalSettings = migrateSettings({
    ...settings,
    display: {
      ...(settings.display || {}),
      prestartMinutes: editorPrestartMinutes,
    },
  });

  if (!selectedDevice) {
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

  const scheduleOverride = isScheduleOverride(selectedDevice.overrides?.schedule)
    ? selectedDevice.overrides?.schedule
    : undefined;

  const settingsOverride = getDeviceOverrideSettings(selectedDevice);
  settingsOverride.slideshow = {
    ...editorConfig,
    version: (editorConfig.version || 1) + (isDirty ? 1 : 0),
  };

  if (editorAudioOverride) {
    settingsOverride.audio = editorAudioOverride;
  } else {
    delete settingsOverride.audio;
  }

  const mergedSettings = migrateSettings(
    deepMergeRecords(
      globalSettings as unknown as Record<string, unknown>,
      settingsOverride,
    ) as unknown as Settings,
  );

  const effectiveSchedule = selectedDevice.mode === 'override' && scheduleOverride
    ? scheduleOverride
    : previewSchedule;

  return {
    schedule: effectiveSchedule,
    settings: mergedSettings,
  };
}

export function buildCurrentSlideshowSnapshot(input: {
  editorConfig: SlideshowConfig | null;
  editorPrestartMinutes: number;
  selectedDevice: Device | null;
  editorAudioOverride: AudioSettings | null;
}): SlideshowWorkflowSnapshot | null {
  const {
    editorConfig,
    editorPrestartMinutes,
    selectedDevice,
    editorAudioOverride,
  } = input;

  if (!editorConfig) return null;

  return {
    config: editorConfig,
    prestartMinutes: editorPrestartMinutes,
    audioOverride: selectedDevice ? editorAudioOverride : null,
  };
}
