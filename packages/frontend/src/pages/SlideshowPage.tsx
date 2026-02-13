import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { DeviceOverridesDialog } from '@/components/Devices/DeviceOverridesDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { useDevices, useUpdateDevice } from '@/hooks/useDevices';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { Device } from '@/types/device.types';
import { getDeviceStatus, getModeLabel, getStatusColor, getStatusLabel } from '@/types/device.types';
import type { SlideshowConfig } from '@/types/slideshow.types';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import { migrateSettings } from '@/utils/slideshowMigration';
import { AlertCircle, Monitor, RefreshCw, Save, Settings } from 'lucide-react';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasDeviceSlideshowOverrides(device: Device): boolean {
  const scheduleOverride = device.overrides?.schedule;
  const settingsOverride = device.overrides?.settings;

  const hasScheduleOverride = isPlainRecord(scheduleOverride) && 'presets' in scheduleOverride;
  const hasSettingsOverride = isPlainRecord(settingsOverride) && Object.keys(settingsOverride).length > 0;

  return hasScheduleOverride || hasSettingsOverride;
}

function getDeviceSlideshowSource(device: Device): {
  label: string;
  detail: string;
  badgeClass: string;
  usesGlobal: boolean;
} {
  const hasOverrides = hasDeviceSlideshowOverrides(device);

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
      detail: 'Modus ist Ueberschrieben, aber es sind keine Overrides gespeichert.',
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

export function SlideshowPage() {
  const { settings, isLoading, error, save, isSaving, refetch } = useSettings();
  const { schedule } = useSchedule();
  const { data: devices = [] } = useDevices();
  const updateDevice = useUpdateDevice();

  const [localConfig, setLocalConfig] = useState<SlideshowConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [overrideDevice, setOverrideDevice] = useState<Device | null>(null);

  const previewSchedule = schedule || createDefaultSchedule();

  const pairedDevices = useMemo(
    () => devices.filter((device) => Boolean(device.pairedAt)),
    [devices]
  );

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

  const previewSettings = useMemo(() => {
    if (!settings || !localConfig) return null;

    return migrateSettings({
      ...settings,
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + (isDirty ? 1 : 0),
      },
    });
  }, [settings, localConfig, isDirty]);

  useEffect(() => {
    if (isInitialized || !settings) return;

    setLocalConfig(settings.slideshow || createDefaultSlideshowConfig());
    setIsInitialized(true);
  }, [isInitialized, settings]);

  const handleConfigChange = (nextConfig: SlideshowConfig) => {
    setLocalConfig(nextConfig);
    setIsDirty(true);
  };

  const handleSaveAll = () => {
    if (!settings || !localConfig) return;

    const updatedSettings = {
      ...settings,
      slideshow: {
        ...localConfig,
        version: (localConfig.version || 1) + 1,
      },
      version: (settings.version || 1) + 1,
    };

    save(updatedSettings, {
      onSuccess: () => {
        setIsDirty(false);
      },
    });
  };

  const handleReload = () => {
    setIsInitialized(false);
    setIsDirty(false);
    refetch();
  };

  const handleDeviceModeChange = (device: Device, mode: 'auto' | 'override') => {
    if (device.mode === mode) return;
    updateDevice.mutate({
      id: device.id,
      updates: { mode },
    });
  };

  if (isLoading || !localConfig) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-spa-text-secondary">Laedt Slideshow-Konfiguration...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Fehler beim Laden</h3>
            <p className="text-red-700 text-sm mt-1">
              {error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'}
            </p>
          </div>
        </div>
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
              Globaler Stand
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Aenderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </button>

            <button
              onClick={handleSaveAll}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary">Geraete-Ausspielung</h3>
              <p className="text-xs text-spa-text-secondary mt-1">
                Hier siehst du pro Display, ob gerade die globale Slideshow oder ein Override laeuft.
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

                return (
                  <div
                    key={device.id}
                    className="rounded-lg border border-spa-bg-secondary p-4"
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
                          onClick={() => setOverrideDevice(device)}
                          className="inline-flex items-center gap-2 rounded-md bg-spa-secondary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-spa-secondary-dark"
                        >
                          <Settings className="h-4 w-4" />
                          Override
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {previewSettings && (
          <SlideshowConfigPanel
            config={localConfig}
            onChange={handleConfigChange}
            previewSchedule={previewSchedule}
            previewSettings={previewSettings}
            isDirty={isDirty}
            disabled={isSaving}
          />
        )}

        <DeviceOverridesDialog
          device={overrideDevice}
          isOpen={Boolean(overrideDevice)}
          onClose={() => setOverrideDevice(null)}
        />
      </div>
    </Layout>
  );
}
