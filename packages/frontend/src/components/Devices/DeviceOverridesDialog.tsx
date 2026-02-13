import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save, X } from 'lucide-react';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useClearOverrides, useSetOverrides } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import { createDefaultSlideshowConfig, type SlideshowConfig } from '@/types/slideshow.types';
import { getDefaultSettings, type AudioSettings, type Settings } from '@/types/settings.types';
import { migrateSettings } from '@/utils/slideshowMigration';

interface DeviceOverridesDialogProps {
  device: Device | null;
  isOpen: boolean;
  onClose: () => void;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeRecords(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainRecord(value) && isPlainRecord(merged[key])) {
      merged[key] = deepMergeRecords(merged[key] as Record<string, unknown>, value);
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

function isScheduleOverride(value: unknown): value is Schedule {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.version === 'number' &&
    isPlainRecord(value.presets) &&
    typeof value.autoPlay === 'boolean'
  );
}

function cloneConfig(config: SlideshowConfig): SlideshowConfig {
  return JSON.parse(JSON.stringify(config)) as SlideshowConfig;
}

function getOverrideSettings(device: Device | null): Record<string, unknown> {
  const settings = device?.overrides?.settings;
  return isPlainRecord(settings) ? { ...settings } : {};
}

function getOverrideSlideshowConfig(device: Device | null): SlideshowConfig | null {
  const settings = getOverrideSettings(device);
  const raw = settings.slideshow;
  if (!isPlainRecord(raw) || !Array.isArray(raw.slides)) return null;

  const defaults = createDefaultSlideshowConfig();
  return {
    ...defaults,
    ...raw,
    slides: raw.slides as SlideshowConfig['slides'],
  };
}

function toAudioSettings(raw: unknown): AudioSettings | null {
  if (!isPlainRecord(raw)) return null;

  const enabled = Boolean(raw.enabled);
  const volume = typeof raw.volume === 'number' && Number.isFinite(raw.volume)
    ? Math.min(1, Math.max(0, raw.volume))
    : 0.5;
  const loop = raw.loop !== false;
  const src = typeof raw.src === 'string' && raw.src.trim().length > 0 ? raw.src : undefined;
  const mediaId = typeof raw.mediaId === 'string' && raw.mediaId.trim().length > 0 ? raw.mediaId : undefined;

  return {
    enabled,
    src,
    mediaId,
    volume,
    loop,
  };
}

export function DeviceOverridesDialog({ device, isOpen, onClose }: DeviceOverridesDialogProps) {
  const { settings: globalSettings } = useSettings();
  const { schedule: globalSchedule } = useSchedule();
  const setOverrides = useSetOverrides();
  const clearOverrides = useClearOverrides();

  const [localConfig, setLocalConfig] = useState<SlideshowConfig | null>(null);
  const [localAudioOverride, setLocalAudioOverride] = useState<AudioSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const isBusy = setOverrides.isPending || clearOverrides.isPending;

  const hasStoredSlideshowOrAudioOverride = useMemo(() => {
    const settings = getOverrideSettings(device);
    return Boolean(settings.slideshow) || Boolean(settings.audio);
  }, [device]);

  useEffect(() => {
    if (!isOpen || !device) return;

    const overrideConfig = getOverrideSlideshowConfig(device);
    const fallbackConfig = globalSettings?.slideshow || createDefaultSlideshowConfig();
    const initialConfig = cloneConfig(overrideConfig || fallbackConfig);

    setLocalConfig(initialConfig);
    setLocalAudioOverride(toAudioSettings(getOverrideSettings(device).audio));
    setIsDirty(false);
  }, [device, globalSettings?.slideshow, isOpen]);

  const previewConfigPayload = useMemo(() => {
    const baseSchedule = globalSchedule || createDefaultSchedule();
    const baseSettings = migrateSettings(globalSettings || getDefaultSettings());

    const scheduleOverride = isScheduleOverride(device?.overrides?.schedule)
      ? device.overrides?.schedule
      : undefined;

    const settingsOverride = getOverrideSettings(device);
    if (localConfig) {
      settingsOverride.slideshow = {
        ...localConfig,
        version: (localConfig.version || 1) + (isDirty ? 1 : 0),
      };
    }

    if (localAudioOverride) {
      settingsOverride.audio = localAudioOverride;
    } else {
      delete settingsOverride.audio;
    }

    const mergedSettings = migrateSettings(
      deepMergeRecords(
        baseSettings as unknown as Record<string, unknown>,
        settingsOverride
      ) as unknown as Settings
    );

    const useOverride = device?.mode === 'override';
    return {
      schedule: useOverride && scheduleOverride ? scheduleOverride : baseSchedule,
      settings: useOverride ? mergedSettings : baseSettings,
    };
  }, [
    device?.mode,
    device?.overrides?.schedule,
    device?.overrides?.settings,
    globalSchedule,
    globalSettings,
    isDirty,
    localAudioOverride,
    localConfig,
  ]);

  const handleClose = () => {
    if (isBusy) return;
    onClose();
  };

  const handleSaveOverrides = () => {
    if (!device || !localConfig) return;

    const currentSettingsOverride = getOverrideSettings(device);
    const nextSettings: Record<string, unknown> = {
      ...currentSettingsOverride,
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + 1,
      },
    };

    if (localAudioOverride) {
      nextSettings.audio = localAudioOverride;
    } else {
      delete nextSettings.audio;
    }

    setOverrides.mutate(
      {
        id: device.id,
        overrides: { settings: nextSettings as Partial<Settings> },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          onClose();
        },
      }
    );
  };

  const handleRemoveOverrides = () => {
    if (!device) return;

    const currentSettingsOverride = getOverrideSettings(device);
    delete currentSettingsOverride.slideshow;
    delete currentSettingsOverride.audio;

    const hasRemainingSettingsOverride = Object.keys(currentSettingsOverride).length > 0;
    const existingSchedule = device.overrides?.schedule;
    const scheduleOverride = isScheduleOverride(existingSchedule) ? existingSchedule : undefined;

    if (hasRemainingSettingsOverride || scheduleOverride) {
      const nextSettingsOverride = hasRemainingSettingsOverride
        ? currentSettingsOverride as Partial<Settings>
        : {};

      setOverrides.mutate(
        {
          id: device.id,
          overrides: {
            settings: nextSettingsOverride,
            schedule: scheduleOverride,
          },
        },
        {
          onSuccess: () => {
            onClose();
          },
        }
      );
      return;
    }

    clearOverrides.mutate(device.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  if (!isOpen || !device) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-spa-bg-secondary p-6">
          <div>
            <h2 className="text-2xl font-bold text-spa-text-primary">Slideshow Override verwalten</h2>
            <p className="mt-1 text-sm text-spa-text-secondary">
              Geraet: {device.name} ({device.id})
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            className="rounded-lg p-2 text-spa-text-secondary transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
            aria-label="Schliessen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 p-4">
            <p className="text-sm text-spa-text-primary">
              {hasStoredSlideshowOrAudioOverride
                ? 'Dieses Geraet nutzt bereits eine eigene Slideshow-/Audio-Konfiguration.'
                : 'Noch kein eigenes Slideshow-/Audio-Override. Beim Speichern wird ein Override fuer dieses Geraet erstellt.'}
            </p>
          </div>

          {device.mode !== 'override' && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900 font-medium">Hinweis zum Modus</p>
              <p className="mt-1 text-sm text-amber-700">
                Dieses Geraet steht auf <strong>Automatisch</strong>. Das gespeicherte Override wird erst genutzt,
                wenn der Modus auf <strong>Ueberschrieben</strong> steht.
              </p>
            </div>
          )}

          {!localConfig && (
            <div className="rounded-lg border border-spa-bg-secondary bg-white p-6 text-spa-text-secondary">
              Lade Slideshow-Konfiguration...
            </div>
          )}

          {localConfig && (
            <SlideshowConfigPanel
              config={localConfig}
              onChange={(nextConfig) => {
                setLocalConfig(nextConfig);
                setIsDirty(true);
              }}
              previewSchedule={previewConfigPayload.schedule}
              previewSettings={previewConfigPayload.settings}
              isDirty={isDirty}
              disabled={isBusy}
              showOpenPreviewButton={false}
              showAudioOverride
              audioOverride={localAudioOverride}
              onAudioOverrideChange={(audio) => {
                setLocalAudioOverride(audio);
                setIsDirty(true);
              }}
              audioTitle="Geraete-Musik"
              audioSubtitle="Ueberschreibt globale Musik nur fuer dieses Display."
              audioEnableLabel="Musik fuer dieses Geraet aktivieren"
              audioEnableDescription="Wird nur genutzt, wenn der Geraetemodus auf Ueberschrieben steht."
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-spa-bg-secondary p-6">
          <button
            onClick={handleRemoveOverrides}
            disabled={isBusy || !hasStoredSlideshowOrAudioOverride}
            className="inline-flex items-center gap-2 rounded-md border border-spa-bg-secondary px-4 py-2 text-sm text-spa-text-primary transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Slideshow/Audio Override entfernen
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isBusy}
              className="rounded-md bg-spa-bg-secondary px-4 py-2 text-spa-text-primary transition-colors hover:bg-spa-secondary/20 disabled:opacity-50"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSaveOverrides}
              disabled={isBusy || !isDirty || !localConfig}
              className="inline-flex items-center gap-2 rounded-md bg-spa-primary px-4 py-2 font-medium text-white transition-colors hover:bg-spa-primary-dark disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {setOverrides.isPending ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
