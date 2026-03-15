import { useEffect, useMemo, useState } from 'react';
import { DisplayLivePreview } from '@/components/Display/DisplayLivePreview';
import { useDevices } from '@/hooks/useDevices';
import type { Device } from '@/types/device.types';
import { getModeLabel } from '@/types/device.types';
import type { Schedule } from '@/types/schedule.types';
import { getActiveEvent, type Settings } from '@/types/settings.types';
import { getDeviceOverrideSettings, hasDeviceOverrides } from '@/utils/deviceUtils';
import { deepMergeRecords, isPlainRecord } from '@/utils/objectUtils';
import { migrateSettings } from '@/utils/slideshowMigration';
import { CalendarClock, Layers3, Monitor, Sparkles, Wrench } from 'lucide-react';
import clsx from 'clsx';
import { StatusBadge } from '@/components/StatusBadge';

interface DisplayScenarioPreviewProps {
  schedule: Schedule;
  settings: Settings;
  devices?: Device[];
  allowedDeviceIds?: string[];
  defaultDeviceId?: string | null;
  defaultPreviewAt?: string | Date | null;
  aspectRatio?: string;
  className?: string;
  previewClassName?: string;
}

function isScheduleLike(value: unknown): value is Schedule {
  return (
    isPlainRecord(value) &&
    typeof value.version === 'number' &&
    isPlainRecord(value.presets) &&
    typeof value.autoPlay === 'boolean'
  );
}

function formatDateTimeLocal(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizePreviewAtInput(value?: string | Date | null): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateTimeLocal(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateTimeLocal(parsed);
    }
  }

  return formatDateTimeLocal(new Date());
}

function parsePreviewAtInput(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getPreviewModeLabel(device: Device | null, applyDeviceOverride: boolean): string {
  if (!device) return 'Globaler Kontext';
  if (!hasDeviceOverrides(device)) return `Live: ${getModeLabel(device.mode)}`;
  if (applyDeviceOverride && device.mode === 'override') return 'Aktives Override';
  if (applyDeviceOverride) return 'Override simuliert';
  if (device.mode === 'override') return 'Global simuliert';
  return `Live: ${getModeLabel(device.mode)}`;
}

function getOutputModeLabel(maintenanceMode: boolean): string {
  return maintenanceMode ? 'Wartungsscreen aktiv' : 'Normale Ausspielung';
}

export function DisplayScenarioPreview({
  schedule,
  settings,
  devices,
  allowedDeviceIds,
  defaultDeviceId = null,
  defaultPreviewAt,
  aspectRatio = '16 / 9',
  className,
  previewClassName,
}: DisplayScenarioPreviewProps) {
  const { data: queriedDevices = [] } = useDevices();

  const pairedDevices = useMemo(() => {
    const source = devices || queriedDevices;
    const paired = source.filter((device) => Boolean(device.pairedAt));

    if (!allowedDeviceIds || allowedDeviceIds.length === 0) {
      return paired;
    }

    const allowed = new Set(allowedDeviceIds);
    return paired.filter((device) => allowed.has(device.id));
  }, [allowedDeviceIds, devices, queriedDevices]);

  const [previewDeviceId, setPreviewDeviceId] = useState<string | null>(defaultDeviceId);
  const [previewAtInput, setPreviewAtInput] = useState<string>(() => normalizePreviewAtInput(defaultPreviewAt));
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [applyDeviceOverride, setApplyDeviceOverride] = useState(false);

  useEffect(() => {
    setPreviewAtInput(normalizePreviewAtInput(defaultPreviewAt));
  }, [defaultPreviewAt]);

  useEffect(() => {
    const hasCurrentDevice = previewDeviceId
      ? pairedDevices.some((device) => device.id === previewDeviceId)
      : false;
    const hasDefaultDevice = defaultDeviceId
      ? pairedDevices.some((device) => device.id === defaultDeviceId)
      : false;

    if (hasCurrentDevice) {
      return;
    }

    if (hasDefaultDevice) {
      setPreviewDeviceId(defaultDeviceId);
      return;
    }

    if (previewDeviceId) {
      setPreviewDeviceId(pairedDevices[0]?.id || null);
    }
  }, [defaultDeviceId, pairedDevices, previewDeviceId]);

  const selectedDevice = useMemo(
    () => pairedDevices.find((device) => device.id === previewDeviceId) || null,
    [pairedDevices, previewDeviceId],
  );
  const liveMaintenanceMode = Boolean(selectedDevice?.maintenanceMode);

  const selectedDeviceHasOverrides = Boolean(selectedDevice && hasDeviceOverrides(selectedDevice));

  useEffect(() => {
    if (!selectedDeviceHasOverrides || !selectedDevice) {
      setApplyDeviceOverride(false);
      return;
    }

    setApplyDeviceOverride(selectedDevice.mode === 'override');
  }, [selectedDevice, selectedDeviceHasOverrides]);

  useEffect(() => {
    setMaintenanceMode(liveMaintenanceMode);
  }, [liveMaintenanceMode, selectedDevice?.id]);

  const shouldApplyDeviceOverride = Boolean(selectedDevice && applyDeviceOverride && selectedDeviceHasOverrides);

  const effectivePreviewSchedule = useMemo(() => {
    if (!selectedDevice || !shouldApplyDeviceOverride) {
      return schedule;
    }

    return isScheduleLike(selectedDevice.overrides?.schedule)
      ? selectedDevice.overrides.schedule
      : schedule;
  }, [schedule, selectedDevice, shouldApplyDeviceOverride]);

  const effectivePreviewSettings = useMemo(() => {
    if (!selectedDevice || !shouldApplyDeviceOverride) {
      return migrateSettings(settings);
    }

    const deviceOverrideSettings = getDeviceOverrideSettings(selectedDevice);
    if (Object.keys(deviceOverrideSettings).length === 0) {
      return migrateSettings(settings);
    }

    return migrateSettings(
      deepMergeRecords(
        settings as unknown as Record<string, unknown>,
        deviceOverrideSettings,
      ) as unknown as Settings,
    );
  }, [selectedDevice, settings, shouldApplyDeviceOverride]);

  const previewAtDate = useMemo(
    () => parsePreviewAtInput(previewAtInput),
    [previewAtInput],
  );

  const activeEvent = useMemo(
    () => getActiveEvent(effectivePreviewSettings, previewAtDate, previewDeviceId),
    [effectivePreviewSettings, previewAtDate, previewDeviceId],
  );

  const previewAtIso = useMemo(
    () => previewAtDate.toISOString(),
    [previewAtDate],
  );

  const previewDiffersFromLiveOutput = Boolean(selectedDevice) && maintenanceMode !== liveMaintenanceMode;

  return (
    <div className={clsx('grid gap-4 xl:grid-cols-[320px_1fr]', className)}>
      <div className="space-y-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-spa-text-secondary">
            Szenario
          </div>
          <div className="mt-2 text-base font-semibold text-spa-text-primary">
            Display-Kontext simulieren
          </div>
          <p className="mt-1 text-sm text-spa-text-secondary">
            Vorschau für Gerät, Zeitpunkt und Betriebsmodus direkt über den echten `/display`-Pfad.
          </p>
        </div>

        {pairedDevices.length > 0 ? (
          <div>
            <label className="mb-2 block text-sm font-medium text-spa-text-primary">
              Zielgerät
            </label>
            <select
              value={previewDeviceId || ''}
              onChange={(event) => setPreviewDeviceId(event.target.value || null)}
              className="w-full rounded-lg border border-spa-bg-secondary px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-spa-primary"
            >
              <option value="">Globaler Kontext</option>
              {pairedDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-spa-bg-secondary bg-white/70 px-4 py-4 text-sm text-spa-text-secondary">
            Keine gekoppelten Geräte verfügbar. Die Vorschau läuft im globalen Kontext.
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-spa-text-primary">
            Zeitpunkt
          </label>
          <div className="relative">
            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-spa-text-secondary" />
            <input
              type="datetime-local"
              value={previewAtInput}
              onChange={(event) => setPreviewAtInput(event.target.value)}
              className="w-full rounded-lg border border-spa-bg-secondary py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-spa-primary"
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-xl border border-spa-bg-secondary bg-white px-4 py-3">
          <div>
            <div className="text-sm font-medium text-spa-text-primary">Wartungsmodus in Vorschau</div>
            <div className="text-xs text-spa-text-secondary">
              {selectedDevice
                ? `Live auf ${selectedDevice.name}: ${liveMaintenanceMode ? 'Wartungsmodus aktiv' : 'keine Wartung aktiv'}.`
                : 'Zeigt direkt den Wartungsscreen für dieses Szenario.'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(event) => setMaintenanceMode(event.target.checked)}
            className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
          />
        </label>

        {selectedDevice && selectedDeviceHasOverrides && (
          <label className="flex items-center justify-between gap-4 rounded-xl border border-spa-bg-secondary bg-white px-4 py-3">
            <div>
              <div className="text-sm font-medium text-spa-text-primary">Geräte-Override anwenden</div>
              <div className="text-xs text-spa-text-secondary">
                Nutzt gespeicherte Override-Daten für {selectedDevice.name} in der Vorschau.
              </div>
            </div>
            <input
              type="checkbox"
              checked={applyDeviceOverride}
              onChange={(event) => setApplyDeviceOverride(event.target.checked)}
              className="h-4 w-4 rounded border-spa-bg-secondary text-spa-primary focus:ring-spa-primary"
            />
          </label>
        )}

        <div className="space-y-3 rounded-xl border border-spa-bg-secondary bg-white px-4 py-4 text-sm text-spa-text-secondary">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-spa-text-secondary">
            <Sparkles className="h-4 w-4" />
            Aktiver Kontext
          </div>

          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-4 w-4 text-spa-primary" />
            <div>
              <div className="font-medium text-spa-text-primary">Ausspielung</div>
              <div>{selectedDevice?.name || 'Globaler Kontext'}</div>
              <div className="mt-0.5 text-xs">{getPreviewModeLabel(selectedDevice, applyDeviceOverride)}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 text-spa-primary" />
            <div>
              <div className="font-medium text-spa-text-primary">Vorschau-Zeit</div>
              <div>{previewAtDate.toLocaleString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers3 className="mt-0.5 h-4 w-4 text-spa-primary" />
            <div>
              <div className="font-medium text-spa-text-primary">Event-Kontext</div>
              <div>{activeEvent ? activeEvent.name : 'Kein Event aktiv'}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-4 w-4 text-spa-primary" />
            <div>
              <div className="font-medium text-spa-text-primary">Live-Status des Geräts</div>
              <div>{selectedDevice ? getOutputModeLabel(liveMaintenanceMode) : 'Kein Gerät ausgewählt'}</div>
              {selectedDevice ? (
                <div className="mt-1">
                  <StatusBadge
                    label={liveMaintenanceMode ? 'Wartungsmodus aktiv' : 'Normale Live-Ausspielung'}
                    tone={liveMaintenanceMode ? 'warning' : 'success'}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Wrench className="mt-0.5 h-4 w-4 text-spa-primary" />
            <div>
              <div className="font-medium text-spa-text-primary">Diese Vorschau zeigt</div>
              <div>{getOutputModeLabel(maintenanceMode)}</div>
              {selectedDevice && previewDiffersFromLiveOutput ? (
                <div className="mt-1">
                  <StatusBadge label="Weicht vom Live-Status ab" tone="warning" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {selectedDevice && liveMaintenanceMode && !maintenanceMode ? (
          <div className="rounded-xl border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
            <div className="font-semibold text-spa-text-primary">
              {selectedDevice.name} sendet live gerade nicht diese Slideshow aus.
            </div>
            <div className="mt-1">
              Das Gerät befindet sich aktuell im Wartungsmodus. Die Vorschau zeigt hier bewusst den konfigurierten Inhalt und nicht die reale Live-Ausspielung.
            </div>
          </div>
        ) : null}

        <DisplayLivePreview
          schedule={effectivePreviewSchedule}
          settings={effectivePreviewSettings}
          deviceId={previewDeviceId}
          deviceName={selectedDevice?.name || null}
          previewAt={previewAtIso}
          maintenanceMode={maintenanceMode}
          aspectRatio={aspectRatio}
          className={previewClassName}
        />
      </div>
    </div>
  );
}
