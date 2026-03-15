import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Layers,
  Monitor,
  Radio,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DashboardLiveState } from '@/hooks/useDashboardData';
import type { SystemJob } from '@/services/api';
import type { RunningSlideshowGroup } from '@/components/Dashboard/LiveOperationsWidget';
import type { PresetKey } from '@/types/schedule.types';
import { PRESET_LABELS } from '@/types/schedule.types';

interface OperationsPulseWidgetProps {
  liveState: DashboardLiveState;
  activeSystemJobs: SystemJob[];
  runningSlideshows: RunningSlideshowGroup[];
  nextEventLabel: string;
  activePreset: PresetKey | null;
  autoPlay: boolean;
}

function PulseMetric({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: typeof Monitor;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="rounded-2xl border border-white/70 bg-white/85 p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-center gap-2 text-spa-text-secondary">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-spa-text-primary">{value}</p>
      <p className="mt-1 text-sm text-spa-text-secondary">{detail}</p>
    </Link>
  );
}

export function OperationsPulseWidget({
  liveState,
  activeSystemJobs,
  runningSlideshows,
  nextEventLabel,
  activePreset,
  autoPlay,
}: OperationsPulseWidgetProps) {
  const presetLabel = activePreset ? PRESET_LABELS[activePreset] : 'Kein Live-Preset';
  const activeEventLabel = liveState.activeEvent
    ? `${liveState.activeEvent.name} bis ${liveState.activeEvent.endTime || '23:59'}`
    : 'Kein Event aktiv';
  const jobLabel = activeSystemJobs.length > 0
    ? activeSystemJobs[0]?.progress?.message || activeSystemJobs[0]?.title
    : 'Keine laufenden Jobs';

  return (
    <section className="rounded-2xl border border-spa-secondary/20 bg-gradient-to-br from-spa-secondary/10 via-white to-spa-primary/10 p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-spa-text-primary">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-spa-primary/10 text-spa-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold">Live-Puls</h3>
              <p className="mt-1 text-sm text-spa-text-secondary">
                Was gerade ausgespielt wird und was als Nächstes ansteht.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={autoPlay ? 'Auto-Play aktiv' : 'Manueller Modus'}
            tone={autoPlay ? 'success' : 'warning'}
            showDot={false}
          />
          <StatusBadge
            label={liveState.activeEvent ? 'Event live' : 'Regelbetrieb'}
            tone={liveState.activeEvent ? 'info' : 'neutral'}
            showDot={false}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <PulseMetric
          icon={Radio}
          label="Jetzt aktiv"
          value={presetLabel}
          detail={activeEventLabel}
          href="/schedule"
        />
        <PulseMetric
          icon={CalendarClock}
          label="Nächster Termin"
          value={nextEventLabel}
          detail={liveState.activeEvent ? 'Event-Override ist bereits aktiv.' : 'Event-Planung und Zeitraum im Blick behalten.'}
          href="/settings"
        />
        <PulseMetric
          icon={Layers}
          label="Ausspielung"
          value={`${runningSlideshows.length} Slideshow${runningSlideshows.length === 1 ? '' : 's'} live`}
          detail={`${liveState.activeOverrideDevices} Override${liveState.activeOverrideDevices === 1 ? '' : 's'} aktiv · ${liveState.devicesWithOverrides} gespeichert`}
          href="/slideshow"
        />
        <PulseMetric
          icon={Monitor}
          label="Displays"
          value={`${liveState.onlineDevices}/${liveState.pairedDevices.length} online`}
          detail={`${liveState.pendingPairings} offen · ${liveState.offlineDevices} offline`}
          href="/devices"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-spa-text-primary">
              <Settings2 className="h-4 w-4" />
              Hintergrundjobs
            </div>
            <p className="mt-1 text-sm text-spa-text-secondary">{jobLabel}</p>
          </div>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-xl bg-spa-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-spa-primary-dark"
          >
            System öffnen
          </Link>
        </div>
      </div>
    </section>
  );
}
