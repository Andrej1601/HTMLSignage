import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { useClearOverrides, useDevices, useSetOverrides, useUpdateDevice } from '@/hooks/useDevices';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { createDefaultSchedule, type Schedule } from '@/types/schedule.types';
import type { Device } from '@/types/device.types';
import { getDeviceStatus, getModeLabel, getStatusColor, getStatusLabel } from '@/types/device.types';
import { createDefaultSlideshowConfig, type SlideshowConfig } from '@/types/slideshow.types';
import type { AudioSettings, Settings } from '@/types/settings.types';
import { migrateSettings } from '@/utils/slideshowMigration';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Monitor, RefreshCw, RotateCcw, Save } from 'lucide-react';

import { isPlainRecord, deepMergeRecords } from '@/utils/objectUtils';
import { parseAudioSettings } from '@/utils/audioUtils';
import { hasDeviceOverrides, getDeviceOverrideSettings } from '@/utils/deviceUtils';

function isScheduleOverride(value: unknown): value is Schedule {
  if (!isPlainRecord(value)) return false;
  return (
    typeof value.version === 'number' &&
    isPlainRecord(value.presets) &&
    typeof value.autoPlay === 'boolean'
  );
}

function getOverrideSlideshowConfig(device: Device | null): SlideshowConfig | null {
  const settings = getDeviceOverrideSettings(device);
  const raw = settings.slideshow;
  if (!isPlainRecord(raw) || !Array.isArray(raw.slides)) return null;

  return {
    ...createDefaultSlideshowConfig(),
    ...raw,
    slides: raw.slides as SlideshowConfig['slides'],
  };
}

function hasStoredSlideshowOrAudioOverride(device: Device | null): boolean {
  const settingsOverride = getDeviceOverrideSettings(device);
  return Boolean(settingsOverride.slideshow) || Boolean(settingsOverride.audio);
}

function getDeviceSlideshowSource(device: Device): {
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
      badgeClass: 'bg-blue-100 text-blue-700',
      usesGlobal: false,
    };
  }

  if (device.mode === 'override' && !hasOverrides) {
    return {
      label: 'Global (kein Override)',
      detail: 'Modus ist Überschrieben, aber es sind keine Overrides gespeichert.',
      badgeClass: 'bg-amber-100 text-amber-700',
      usesGlobal: true,
    };
  }

  if (device.mode === 'auto' && hasOverrides) {
    return {
      label: 'Global (Override hinterlegt)',
      detail: 'Override ist gespeichert, wird im Modus Automatisch aber nicht verwendet.',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      usesGlobal: true,
    };
  }

  return {
    label: 'Global',
    detail: 'Dieses Display nutzt die globale Slideshow aus diesem Reiter.',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    usesGlobal: true,
  };
}

type EditorTarget = 'global' | `device:${string}`;

function toDeviceTarget(deviceId: string): EditorTarget {
  return `device:${deviceId}`;
}

function parseDeviceId(target: EditorTarget): string | null {
  return target.startsWith('device:') ? target.slice('device:'.length) : null;
}

export function SlideshowPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();
  const { schedule } = useSchedule();
  const { data: devices = [] } = useDevices();
  const updateDevice = useUpdateDevice();
  const setOverrides = useSetOverrides();
  const clearOverrides = useClearOverrides();

  const pairedDevices = useMemo(
    () => devices.filter((device) => Boolean(device.pairedAt)),
    [devices]
  );

  const [target, setTarget] = useState<EditorTarget>('global');
  const [editorConfig, setEditorConfig] = useState<SlideshowConfig | null>(null);
  const [editorAudioOverride, setEditorAudioOverride] = useState<AudioSettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'switch-target'; nextTarget: EditorTarget } | { type: 'reset' } | null>(null);

  const selectedDeviceId = parseDeviceId(target);
  const selectedDevice = useMemo(
    () => pairedDevices.find((device) => device.id === selectedDeviceId) || null,
    [pairedDevices, selectedDeviceId]
  );

  const previewSchedule = schedule || createDefaultSchedule();

  const deviceSourceSummary = useMemo(() => {
    const summary = {
      global: 0,
      overrideActive: 0,
      overrideStoredInactive: 0,
      overrideModeWithoutData: 0,
    };

    for (const device of pairedDevices) {
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
  }, [pairedDevices]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    if (selectedDevice) return;
    setTarget('global');
    setIsDirty(false);
  }, [selectedDevice, selectedDeviceId]);

  const loadEditorFromTarget = (targetToLoad: EditorTarget) => {
    if (!settings) return;

    if (targetToLoad === 'global') {
      setEditorConfig(settings.slideshow || createDefaultSlideshowConfig());
      setEditorAudioOverride(null);
      setIsDirty(false);
      return;
    }

    const deviceId = parseDeviceId(targetToLoad);
    const device = pairedDevices.find((entry) => entry.id === deviceId) || null;
    const fallback = settings.slideshow || createDefaultSlideshowConfig();
    const overrideConfig = getOverrideSlideshowConfig(device);

    setEditorConfig(overrideConfig || fallback);
    setEditorAudioOverride(parseAudioSettings(getDeviceOverrideSettings(device).audio));
    setIsDirty(false);
  };

  useEffect(() => {
    if (!settings || isDirty) return;
    loadEditorFromTarget(target);
  }, [settings?.version, selectedDevice?.updatedAt, target]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewPayload = useMemo(() => {
    if (!settings || !editorConfig) return null;

    const globalSettings = migrateSettings(settings);

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
        settingsOverride
      ) as unknown as Settings
    );

    const effectiveSchedule = selectedDevice.mode === 'override' && scheduleOverride
      ? scheduleOverride
      : previewSchedule;

    return {
      schedule: effectiveSchedule,
      settings: mergedSettings,
    };
  }, [editorAudioOverride, editorConfig, isDirty, previewSchedule, selectedDevice, settings]);

  const hasActiveDeviceTarget = Boolean(selectedDevice);
  const hasRemovableOverride = hasStoredSlideshowOrAudioOverride(selectedDevice);

  const isBusy = isSaving || setOverrides.isPending || clearOverrides.isPending || updateDevice.isPending;

  const handleSelectTarget = (nextTarget: EditorTarget) => {
    if (nextTarget === target) return;

    if (isDirty) {
      setConfirmAction({ type: 'switch-target', nextTarget });
      return;
    }

    setTarget(nextTarget);
    setIsDirty(false);
  };

  const handleReloadCurrent = () => {
    if (isDirty) {
      setConfirmAction({ type: 'reset' });
      return;
    }

    if (target === 'global') {
      setIsDirty(false);
      refetch();
      return;
    }

    loadEditorFromTarget(target);
  };

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    if (confirmAction.type === 'switch-target') {
      setTarget(confirmAction.nextTarget);
      setIsDirty(false);
    } else if (confirmAction.type === 'reset') {
      if (target === 'global') {
        setIsDirty(false);
        refetch();
      } else {
        loadEditorFromTarget(target);
      }
    }

    setConfirmAction(null);
  }, [confirmAction, target, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveCurrent = () => {
    if (!settings || !editorConfig) return;

    if (!selectedDevice) {
      const updatedSettings = {
        ...settings,
        slideshow: {
          ...editorConfig,
          version: (editorConfig.version || 1) + 1,
        },
        version: (settings.version || 1) + 1,
      };

      save(updatedSettings, {
        onSuccess: () => {
          setIsDirty(false);
        },
      });
      return;
    }

    const currentSettingsOverride = getDeviceOverrideSettings(selectedDevice);
    const nextSettings: Record<string, unknown> = {
      ...currentSettingsOverride,
      slideshow: {
        ...editorConfig,
        version: (editorConfig.version || 1) + 1,
      },
    };

    if (editorAudioOverride) {
      nextSettings.audio = editorAudioOverride;
    } else {
      delete nextSettings.audio;
    }

    setOverrides.mutate(
      {
        id: selectedDevice.id,
        overrides: { settings: nextSettings as Partial<Settings> },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
        },
      }
    );
  };

  const handleRemoveCurrentOverride = () => {
    if (!selectedDevice) return;

    const currentSettingsOverride = getDeviceOverrideSettings(selectedDevice);
    delete currentSettingsOverride.slideshow;
    delete currentSettingsOverride.audio;

    const hasRemainingSettingsOverride = Object.keys(currentSettingsOverride).length > 0;
    const existingSchedule = selectedDevice.overrides?.schedule;
    const scheduleOverride = isScheduleOverride(existingSchedule) ? existingSchedule : undefined;

    if (hasRemainingSettingsOverride || scheduleOverride) {
      const nextSettingsOverride = hasRemainingSettingsOverride
        ? currentSettingsOverride as Partial<Settings>
        : {};

      setOverrides.mutate(
        {
          id: selectedDevice.id,
          overrides: {
            settings: nextSettingsOverride,
            schedule: scheduleOverride,
          },
        },
        {
          onSuccess: () => {
            loadEditorFromTarget(target);
          },
        }
      );
      return;
    }

    clearOverrides.mutate(selectedDevice.id, {
      onSuccess: () => {
        loadEditorFromTarget(target);
      },
    });
  };

  const handleDeviceModeChange = (device: Device, mode: 'auto' | 'override') => {
    if (device.mode === mode) return;

    updateDevice.mutate({
      id: device.id,
      updates: { mode },
    });
  };

  if (isLoading || !settings || !editorConfig || !previewPayload) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Slideshow-Konfiguration..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-spa-text-primary">Slideshow Konfiguration</h2>
            <p className="text-spa-text-secondary mt-1">
              {hasActiveDeviceTarget
                ? `Override-Editor für ${selectedDevice?.name || 'Gerät'}`
                : 'Globaler Stand'}
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Änderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReloadCurrent}
              disabled={isBusy}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Zurücksetzen
            </button>

            {hasActiveDeviceTarget && (
              <button
                onClick={handleRemoveCurrentOverride}
                disabled={isBusy || !hasRemovableOverride}
                className="flex items-center gap-2 px-4 py-2 border border-spa-bg-secondary text-spa-text-primary rounded-md hover:bg-spa-bg-secondary transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Override entfernen
              </button>
            )}

            <button
              onClick={handleSaveCurrent}
              disabled={!isDirty || isBusy}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isBusy ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary">Geräte-Ausspielung</h3>
              <p className="text-xs text-spa-text-secondary mt-1">
                Wähle ein Ziel, um globale Slideshow oder Geräte-Override ohne Popup zu bearbeiten.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                Global: {deviceSourceSummary.global}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                Override aktiv: {deviceSourceSummary.overrideActive}
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                Override hinterlegt: {deviceSourceSummary.overrideStoredInactive}
              </span>
              {deviceSourceSummary.overrideModeWithoutData > 0 && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">
                  Modus Override ohne Daten: {deviceSourceSummary.overrideModeWithoutData}
                </span>
              )}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => handleSelectTarget('global')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                target === 'global'
                  ? 'bg-spa-primary text-white'
                  : 'bg-spa-bg-primary text-spa-text-secondary hover:bg-spa-bg-secondary'
              }`}
            >
              Global
            </button>
            {pairedDevices.map((device) => {
              const tgt = toDeviceTarget(device.id);
              return (
                <button
                  key={device.id}
                  onClick={() => handleSelectTarget(tgt)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    target === tgt
                      ? 'bg-spa-primary text-white'
                      : 'bg-spa-bg-primary text-spa-text-secondary hover:bg-spa-bg-secondary'
                  }`}
                >
                  {device.name}
                </button>
              );
            })}
          </div>

          {pairedDevices.length === 0 ? (
            <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 p-6 text-sm text-spa-text-secondary">
              Keine gekoppelten Displays vorhanden.
            </div>
          ) : (
            <div className="space-y-3">
              {pairedDevices.map((device) => {
                const source = getDeviceSlideshowSource(device);
                const status = getDeviceStatus(device.lastSeen);
                const statusColor = getStatusColor(status);
                const isSelected = target === toDeviceTarget(device.id);

                return (
                  <div
                    key={device.id}
                    className={`rounded-lg border p-4 ${
                      isSelected ? 'border-spa-primary bg-spa-primary/5' : 'border-spa-bg-secondary'
                    }`}
                  >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
                      <div className="lg:col-span-4">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-spa-primary" />
                          <p className="font-semibold text-spa-text-primary">{device.name}</p>
                        </div>
                        <p className="mt-1 font-mono text-xs text-spa-text-secondary">{device.id}</p>
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                          <span className="h-2 w-2 rounded-full bg-current" />
                          {getStatusLabel(status)}
                        </span>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
                          Modus
                        </label>
                        <select
                          value={device.mode}
                          onChange={(event) => handleDeviceModeChange(device, event.target.value as 'auto' | 'override')}
                          disabled={updateDevice.isPending}
                          className="w-full rounded-md border border-spa-bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-60"
                        >
                          <option value="auto">{getModeLabel('auto')}</option>
                          <option value="override">{getModeLabel('override')}</option>
                        </select>
                      </div>

                      <div className="lg:col-span-4">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
                          Aktuelle Quelle
                        </label>
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${source.badgeClass}`}>
                            {source.label}
                          </span>
                          <p className="text-xs text-spa-text-secondary">{source.detail}</p>
                        </div>
                      </div>

                      <div className="flex justify-start lg:col-span-2 lg:justify-end">
                        <button
                          onClick={() => handleSelectTarget(toDeviceTarget(device.id))}
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-spa-primary text-white'
                              : 'bg-spa-secondary text-white hover:bg-spa-secondary-dark'
                          }`}
                        >
                          {isSelected ? 'Im Editor aktiv' : 'Im Editor bearbeiten'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SlideshowConfigPanel
          config={editorConfig}
          onChange={(nextConfig) => {
            setEditorConfig(nextConfig);
            setIsDirty(true);
          }}
          previewSchedule={previewPayload.schedule}
          previewSettings={previewPayload.settings}
          isDirty={isDirty}
          disabled={isBusy}
          showAudioOverride={Boolean(selectedDevice)}
          audioOverride={editorAudioOverride}
          onAudioOverrideChange={selectedDevice ? ((audio) => {
            setEditorAudioOverride(audio);
            setIsDirty(true);
          }) : undefined}
          audioTitle={selectedDevice ? `Geräte-Musik (${selectedDevice.name})` : 'Audio-Override'}
          audioSubtitle={selectedDevice
            ? 'Überschreibt globale Musik nur für dieses Display.'
            : 'Musik für diese Slideshow-Ausgabe konfigurieren.'}
          audioEnableLabel="Musik für dieses Gerät aktivieren"
          audioEnableDescription="Wird nur genutzt, wenn der Gerätemodus auf Überschrieben steht."
        />

        <ConfirmDialog
          isOpen={confirmAction !== null}
          title="Ungespeicherte Änderungen"
          message={
            confirmAction?.type === 'switch-target'
              ? 'Ungespeicherte Änderungen verwerfen und Ziel wechseln?'
              : 'Ungespeicherte Änderungen verwerfen?'
          }
          confirmLabel="Verwerfen"
          variant="warning"
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    </Layout>
  );
}
