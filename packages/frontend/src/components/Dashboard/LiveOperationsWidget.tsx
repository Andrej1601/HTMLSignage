import { Link } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { SlideshowConfig, SlideConfig } from '@/types/slideshow.types';

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

interface LiveOperationsWidgetProps {
  liveState: LiveState;
}

export function LiveOperationsWidget({ liveState }: LiveOperationsWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Live-Betrieb
        </h3>
        <Link
          to="/devices"
          className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
        >
          Zu Geräten
        </Link>
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
    </div>
  );
}
