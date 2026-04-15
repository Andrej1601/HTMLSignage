import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Radio,
  Sparkles,
  MonitorSmartphone,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DashboardLiveState } from '@/hooks/useDashboardData';
import type { RunningSlideshowGroup } from '@/hooks/dashboardData.types';
import type { PresetKey, Schedule } from '@/types/schedule.types';
import { PRESET_LABELS, getTodayPresetKey, resolveLivePresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getActiveEvent } from '@/types/settings.types';
import type { Device } from '@/types/device.types';

interface OperationsPulseWidgetProps {
  liveState: DashboardLiveState;
  runningSlideshows: RunningSlideshowGroup[];
  nextEventLabel: string;
  activePreset: PresetKey | null;
  autoPlay: boolean;
  schedule: Schedule | null;
  settings: Settings | null;
  pairedDevices: Device[];
}

function PulseMetric({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: typeof Radio;
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4 transition-all hover:-translate-y-0.5 hover:shadow-xs"
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

function formatDateTimeLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function OperationsPulseWidget({
  liveState,
  nextEventLabel,
  activePreset,
  autoPlay,
  schedule,
  settings,
  pairedDevices,
}: OperationsPulseWidgetProps) {
  const presetLabel = activePreset ? PRESET_LABELS[activePreset] : 'Kein Live-Preset';
  const activeEventLabel = liveState.activeEvent
    ? `${liveState.activeEvent.name} bis ${liveState.activeEvent.endTime || '23:59'}`
    : 'Kein Event aktiv';
  // Simulation state
  const [simDateTime, setSimDateTime] = useState(() => formatDateTimeLocalInput(new Date()));
  const [simDeviceId, setSimDeviceId] = useState<string>('');

  const simNow = useMemo(() => {
    const parsed = simDateTime ? new Date(simDateTime) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [simDateTime]);

  const simulatedEvent = settings
    ? getActiveEvent(settings, simNow, simDeviceId || undefined)
    : null;

  const simulatedPreset: PresetKey = schedule
    ? resolveLivePresetKey(schedule, settings, simNow, simDeviceId || undefined)
    : getTodayPresetKey(simNow);

  return (
    <section className="rounded-2xl border border-spa-bg-secondary bg-spa-surface p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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

      {/* Live Metrics */}
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
      </div>

      {/* Compact Simulation */}
      <div className="mt-4 rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-spa-text-primary">
          <MonitorSmartphone className="h-4 w-4" />
          Simulation
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-spa-text-secondary">Zeitpunkt</label>
            <input
              type="datetime-local"
              value={simDateTime}
              onChange={(e) => setSimDateTime(e.target.value)}
              className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-spa-text-secondary">Gerät (optional)</label>
            <select
              value={simDeviceId}
              onChange={(e) => setSimDeviceId(e.target.value)}
              className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-1.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-spa-primary"
            >
              <option value="">Global (kein Filter)</option>
              {pairedDevices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-spa-surface border border-spa-bg-secondary px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-spa-text-secondary">Live-Preset</div>
            <div className="mt-1 text-sm font-semibold text-spa-text-primary truncate">{PRESET_LABELS[simulatedPreset]}</div>
            <div className="mt-0.5 text-[10px] text-spa-text-secondary">{simulatedPreset}</div>
          </div>
          <div className="rounded-xl bg-spa-surface border border-spa-bg-secondary px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-spa-text-secondary">Aktives Event</div>
            <div className="mt-1 text-sm font-semibold text-spa-text-primary truncate">
              {simulatedEvent ? simulatedEvent.name : 'Keins'}
            </div>
            <div className="mt-0.5 text-[10px] text-spa-text-secondary">
              {simulatedEvent
                ? `${PRESET_LABELS[simulatedEvent.assignedPreset]} · bis ${simulatedEvent.endTime || '23:59'}`
                : 'Auto-Play / Tagesplan'}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
