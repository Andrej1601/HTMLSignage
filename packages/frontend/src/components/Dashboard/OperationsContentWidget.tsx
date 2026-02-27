import { Link } from 'react-router-dom';
import { Monitor, Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { SlidePreview } from '@/components/Slideshow/SlidePreview';
import { getEnabledSlides, type SlideshowConfig, type SlideConfig } from '@/types/slideshow.types';

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
  livePresetLabel: string;
  autoPlay: boolean;
  activeEventName: string | null;
  planQuality: {
    totalRows: number;
    emptyRows: number;
    inconsistentRows: number;
    duplicateTimeRows: number;
  };
}

export function OperationsContentWidget({
  liveState,
  runningSlideshows,
  livePresetLabel,
  autoPlay,
  activeEventName,
  planQuality,
}: OperationsContentWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      {/* Device Status Section */}
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

      {/* Slideshow Groups */}
      <div className="mt-5 pt-4 border-t border-spa-bg-secondary">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-spa-text-primary">Aktive Slideshow-Ausspielungen</p>
          <Link
            to="/slideshow"
            className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
          >
            Slideshow verwalten
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {runningSlideshows.map((group) => (
            <div key={group.id} className="rounded-lg border border-spa-bg-secondary p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={group.source === 'global' ? 'Global' : 'Override'}
                    tone={group.source === 'global' ? 'success' : 'info'}
                    showDot={false}
                  />
                  <p className="text-sm font-semibold text-spa-text-primary">{group.title}</p>
                </div>
                <span className="text-xs text-spa-text-secondary">
                  {getEnabledSlides(group.config).length} aktive Slides
                </span>
              </div>
              <p className="text-xs text-spa-text-secondary mt-1">
                Läuft auf: {group.deviceNames.length > 0 ? group.deviceNames.join(', ') : 'keinem aktiven Gerät'}
              </p>

              {group.slides.length > 0 ? (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {group.slides.map((slide) => (
                    <SlidePreview
                      key={`${group.id}-${slide.id}`}
                      slide={slide}
                      className="w-28 h-[63px] flex-shrink-0"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-spa-text-secondary mt-2">
                  Keine aktiven Slides konfiguriert.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Quality Section */}
      <div className="mt-5 pt-4 border-t border-spa-bg-secondary">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-spa-text-secondary" />
          <p className="text-sm font-semibold text-spa-text-primary">Inhalte & Planqualität</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-spa-bg-secondary p-4">
            <p className="text-sm font-semibold text-spa-text-primary mb-2">Live-Inhalt</p>
            <div className="space-y-2 text-sm text-spa-text-secondary">
              <div className="flex items-center justify-between">
                <span>Aktives Preset</span>
                <span className="font-semibold text-spa-text-primary">{livePresetLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Modus</span>
                <StatusBadge
                  label={autoPlay ? 'Auto-Play' : 'Manuell'}
                  tone={autoPlay ? 'success' : 'warning'}
                  showDot={false}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Event</span>
                <StatusBadge
                  label={activeEventName || 'Kein aktives Event'}
                  tone={activeEventName ? 'info' : 'neutral'}
                  showDot={false}
                />
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-spa-bg-secondary p-4">
            <p className="text-sm font-semibold text-spa-text-primary mb-2">Plan-Checks</p>
            <div className="space-y-2 text-sm text-spa-text-secondary">
              <div className="flex items-center justify-between">
                <span>Zeilen gesamt</span>
                <span className="font-semibold text-spa-text-primary">{planQuality.totalRows}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Leere Zeilen</span>
                <StatusBadge
                  label={String(planQuality.emptyRows)}
                  tone={planQuality.emptyRows > 0 ? 'warning' : 'success'}
                  showDot={false}
                />
              </div>
              <div className="flex items-center justify-between">
                <span>Konflikte</span>
                <StatusBadge
                  label={String(planQuality.inconsistentRows + planQuality.duplicateTimeRows)}
                  tone={(planQuality.inconsistentRows + planQuality.duplicateTimeRows) > 0 ? 'danger' : 'success'}
                  showDot={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
