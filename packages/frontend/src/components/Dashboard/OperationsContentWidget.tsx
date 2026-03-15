import { Link } from 'react-router-dom';
import { Monitor, Music4, Radio } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import type { DashboardDeviceMonitorItem } from '@/hooks/useDashboardData';
import { DeviceSnapshotPreview } from '@/components/Devices/DeviceSnapshotPreview';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';

interface LiveState {
  onlineDevices: number;
  offlineDevices: number;
  neverSeenDevices: number;
  autoModeDevices: number;
  overrideModeDevices: number;
  activeOverrideDevices: number;
  devicesWithOverrides: number;
}

interface OperationsContentWidgetProps {
  liveState: LiveState;
  deviceMonitoring: DashboardDeviceMonitorItem[];
}

export function OperationsContentWidget({
  liveState,
  deviceMonitoring,
}: OperationsContentWidgetProps) {
  return (
    <DashboardWidgetFrame
      title="Betrieb & Inhalte"
      description="Gerätegesundheit, Overrides und Live-Snapshots an einem operativen Ort."
      icon={Monitor}
      actions={(
        <>
          <Link
            to="/devices"
            className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
          >
            Zu Geräten
          </Link>
          <Link
            to="/schedule"
            className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
          >
            Zum Aufgussplan
          </Link>
        </>
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg bg-spa-bg-primary p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary mb-2">Gerätezustand</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${liveState.onlineDevices} online`} tone="success" />
            <StatusBadge label={`${liveState.offlineDevices} offline`} tone={liveState.offlineDevices > 0 ? 'warning' : 'neutral'} />
            <StatusBadge label={`${liveState.neverSeenDevices} ohne Signal`} tone={liveState.neverSeenDevices > 0 ? 'warning' : 'neutral'} />
          </div>
        </div>
        <div className="rounded-lg bg-spa-bg-primary p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary mb-2">Ausspielungsmodi</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={`${liveState.autoModeDevices} Auto`} tone="success" />
            <StatusBadge label={`${liveState.overrideModeDevices} Override`} tone="info" />
            <StatusBadge label={`${liveState.activeOverrideDevices} Override aktiv`} tone={liveState.activeOverrideDevices > 0 ? 'warning' : 'neutral'} />
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-spa-text-secondary">
        <span className="font-medium text-spa-text-primary">{liveState.devicesWithOverrides}</span> Gerät(e) haben gespeicherte Overrides.
      </div>

      <div className="mt-5 pt-4 border-t border-spa-bg-secondary">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-semibold text-spa-text-primary flex items-center gap-2">
            <Radio className="w-4 h-4" />
            Geräteüberwachung
          </p>
          <span className="text-xs text-spa-text-secondary">{deviceMonitoring.length} gekoppelte Geräte</span>
        </div>

        <div className="max-h-[360px] overflow-y-auto pr-1 overscroll-contain space-y-3">
          {deviceMonitoring.map((device) => (
            <div key={device.id} className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/60 p-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="xl:w-[220px] xl:flex-shrink-0">
                  <DeviceSnapshotPreview
                    snapshotUrl={device.snapshotUrl}
                    capturedAt={device.snapshotCapturedAt}
                    alt={`Live-Snapshot von ${device.name}`}
                    compact
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-spa-text-primary">{device.name}</p>
                    <StatusBadge label={device.statusLabel} tone={device.statusTone} />
                    <StatusBadge label={device.modeLabel} tone={device.modeTone} showDot={false} />
                  </div>
                  <p className="text-xs text-spa-text-secondary mt-1">
                    Letzte Aktivität: {device.lastSeenLabel}
                  </p>
                </div>

                {device.warnings.length > 0 && (
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {device.warnings.map((warning) => (
                      <StatusBadge
                        key={`${device.id}-${warning.label}`}
                        label={warning.label}
                        tone={warning.tone}
                        showDot={false}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                <InfoPill title="Ausspielung" value={device.slideshowLabel} tone={device.slideshowTone} />
                <InfoPill title="Event" value={device.eventLabel} tone={device.eventTone} />
                <InfoPill title="Audio" value={device.audioLabel} tone={device.audioTone} icon={Music4} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}

function InfoPill({
  title,
  value,
  tone,
  icon: Icon,
}: {
  title: string;
  value: string;
  tone: StatusTone;
  icon?: typeof Music4;
}) {
  return (
    <div className="rounded-lg border border-spa-bg-secondary bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary mb-1 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {title}
      </p>
      <StatusBadge label={value} tone={tone} className="max-w-full" />
    </div>
  );
}
