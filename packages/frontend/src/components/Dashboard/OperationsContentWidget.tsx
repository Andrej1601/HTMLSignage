import { Link } from 'react-router-dom';
import { Layout, Layers, Monitor, Music4, Pin, Radio, RotateCw } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import {
  getEnabledSlides,
  getLayout,
  getSlideTypeOption,
  type SlideshowConfig,
  type SlideConfig,
  type Zone,
} from '@/types/slideshow.types';
import type { DashboardDeviceMonitorItem } from '@/hooks/useDashboardData';
import { DeviceSnapshotPreview } from '@/components/Devices/DeviceSnapshotPreview';

interface LiveState {
  onlineDevices: number;
  offlineDevices: number;
  neverSeenDevices: number;
  autoModeDevices: number;
  overrideModeDevices: number;
  activeOverrideDevices: number;
  devicesWithOverrides: number;
}

export interface RunningSlideshowGroup {
  id: string;
  source: 'global' | 'override';
  title: string;
  config: SlideshowConfig;
  slides: SlideConfig[];
  deviceNames: string[];
}

interface OperationsContentWidgetProps {
  liveState: LiveState;
  runningSlideshows: RunningSlideshowGroup[];
  deviceMonitoring: DashboardDeviceMonitorItem[];
}

export function OperationsContentWidget({
  liveState,
  runningSlideshows,
  deviceMonitoring,
}: OperationsContentWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Betrieb & Inhalte
        </h3>
        <div className="flex items-center gap-3">
          <Link
            to="/devices"
            className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
          >
            Zu Geräten
          </Link>
          <Link
            to="/schedule"
            className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
          >
            Zum Aufgussplan
          </Link>
        </div>
      </div>

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

      <div className="mt-5 pt-4 border-t border-spa-bg-secondary">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-spa-text-primary flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Aktive Slideshow-Ausspielungen
          </p>
          <Link
            to="/slideshow"
            className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
          >
            Slideshow verwalten
          </Link>
        </div>
        <div className="mt-3 space-y-4">
          {runningSlideshows.map((group) => {
            const layoutDef = getLayout(group.config.layout);
            const enabledSlides = getEnabledSlides(group.config);
            const zones = layoutDef.zones;
            const slidesByZone = new Map<string, SlideConfig[]>();

            for (const zone of zones) {
              slidesByZone.set(zone.id, []);
            }
            for (const slide of enabledSlides) {
              const zoneId = slide.zoneId || zones[0]?.id || 'main';
              const bucket = slidesByZone.get(zoneId);
              if (bucket) bucket.push(slide);
              else slidesByZone.set(zoneId, [slide]);
            }

            return (
              <div key={group.id} className="rounded-lg border border-spa-bg-secondary overflow-hidden">
                <div className="px-4 py-3 bg-spa-bg-primary/50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={group.source === 'global' ? 'Global' : 'Override'}
                        tone={group.source === 'global' ? 'success' : 'info'}
                        showDot={false}
                      />
                      <p className="text-sm font-semibold text-spa-text-primary">{group.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs text-spa-text-secondary bg-spa-bg-secondary px-2 py-0.5 rounded-full">
                        <Layout className="w-3 h-3" />
                        {layoutDef.label}
                      </span>
                      <span className="text-xs text-spa-text-secondary">{enabledSlides.length} Slides</span>
                    </div>
                  </div>
                  <p className="text-xs text-spa-text-secondary mt-1">
                    Läuft auf: {group.deviceNames.length > 0 ? group.deviceNames.join(', ') : 'keinem aktiven Gerät'}
                  </p>
                </div>

                {enabledSlides.length > 0 ? (
                  <div className="p-3 space-y-2">
                    {zones.map((zone) => {
                      const zoneSlides = slidesByZone.get(zone.id) || [];
                      if (zoneSlides.length === 0 && zones.length > 1) return null;
                      const isRotating = zone.type === 'rotating' || (zone.type === 'smart-persistent' && zoneSlides.length > 1);

                      return (
                        <ZoneCard
                          key={zone.id}
                          zone={zone}
                          slides={zoneSlides}
                          groupId={group.id}
                          isRotating={isRotating}
                          isSingleZone={zones.length === 1}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3">
                    <p className="text-xs text-spa-text-secondary">Keine aktiven Slides konfiguriert.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
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

function ZoneCard({
  zone,
  slides,
  groupId,
  isRotating,
  isSingleZone,
}: {
  zone: Zone;
  slides: SlideConfig[];
  groupId: string;
  isRotating: boolean;
  isSingleZone: boolean;
}) {
  const ZoneIcon = isRotating ? RotateCw : Pin;
  const zoneLabel = isRotating ? 'Rotation' : 'Persistent';

  return (
    <div className="rounded-md border border-spa-bg-secondary bg-white p-2.5">
      {!isSingleZone && (
        <div className="flex items-center gap-2 mb-2">
          <ZoneIcon className="w-3.5 h-3.5 text-spa-text-secondary" />
          <span className="text-xs font-semibold text-spa-text-primary">{zone.name}</span>
          <span className="text-[10px] text-spa-text-secondary bg-spa-bg-secondary px-1.5 py-0.5 rounded-full">
            {zoneLabel} · {slides.length} {slides.length === 1 ? 'Slide' : 'Slides'}
          </span>
        </div>
      )}

      {slides.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((slide) => (
            <div key={`${groupId}-${slide.id}`} className="flex-shrink-0">
              <SlidePreview slide={slide} className="w-24 h-[54px]" />
              <p className="text-[9px] text-spa-text-secondary mt-0.5 text-center truncate max-w-[96px]">
                {slide.title || getSlideTypeOption(slide.type)?.label || slide.type}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-spa-text-secondary italic">Kein Inhalt zugewiesen</p>
      )}
    </div>
  );
}
