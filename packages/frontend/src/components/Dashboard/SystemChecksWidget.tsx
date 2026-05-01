/**
 * System-Checks — Verbindungsstatus, Geräte-Bilanz, Wartung und Warnungen.
 *
 * Geänderte Schwerpunkte gegenüber der vorherigen Version:
 *   - „Verlauf letzte 24h" wurde entfernt. Trend-Kennzahlen waren auf
 *     dem Operations-Dashboard zu abstrakt; konkrete Echtzeit-Werte
 *     liefern mehr Nutzen.
 *   - Speicher-Karte ist nach „Medien & Speicher" umgezogen, weil
 *     Disk-Belegung und Mediathek dort thematisch zusammen gehören.
 *   - Neu: Geräte-Bilanz aus `runtimeStatus.devices` als Mini-Stats-
 *     Strip — Saunameister sehen sofort, ob alle Displays gepairt
 *     sind und ob welche überfällig sind.
 *
 * Layout in vier Bereichen: Verbindungsstatus → (Details-Toggle) →
 * Geräte-Bilanz → Housekeeping → Laufzeitwarnungen.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Globe,
  MonitorCheck,
  RefreshCw,
  Wifi,
  Wrench,
} from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import type { SystemRuntimeStatusResponse } from '@/services/api';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import clsx from 'clsx';

interface SystemChecksWidgetProps {
  backendStatus: 'ok' | 'error' | 'unknown';
  backendTone: StatusTone;
  dataTone: StatusTone;
  websocketTone: StatusTone;
  wsConnected: boolean;
  updateTone: StatusTone;
  isAdmin: boolean;
  updateLabel: string;
  runtimeStatus: SystemRuntimeStatusResponse | null;
}

function getMaintenanceBadge(state: SystemRuntimeStatusResponse['maintenance']['state']): {
  label: string;
  tone: StatusTone;
} {
  switch (state) {
    case 'running':
      return { label: 'Läuft', tone: 'info' };
    case 'ok':
      return { label: 'OK', tone: 'success' };
    case 'error':
      return { label: 'Fehler', tone: 'danger' };
    default:
      return { label: 'Wartet', tone: 'warning' };
  }
}

function getCategoryLabel(category: SystemRuntimeStatusResponse['warnings'][number]['category']): string {
  switch (category) {
    case 'disk':
      return 'Speicher';
    case 'devices':
      return 'Geräte';
    case 'media':
      return 'Medien';
    case 'maintenance':
      return 'Wartung';
  }
}

// Mini-Stat-Tile für die Geräte-Bilanz.
function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    neutral: 'border-spa-bg-secondary bg-spa-bg-primary/40 text-spa-text-primary',
    success: 'border-spa-success/30 bg-spa-success-light/50 text-spa-success-dark',
    warning: 'border-spa-warning/40 bg-spa-warning-light/60 text-spa-warning-dark',
    danger: 'border-spa-error/40 bg-spa-error-light/60 text-spa-error-dark',
  };
  return (
    <div className={clsx('rounded-lg border px-2.5 py-2', styles[tone])}>
      <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </p>
    </div>
  );
}

// Status-Zeile mit Icon + Label + Badge — kompakter als die alte
// Vertikal-Liste mit reinem `text-sm`-Label.
function ConnectivityRow({
  icon: Icon,
  label,
  badge,
}: {
  icon: typeof Globe;
  label: string;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/30 px-3 py-2">
      <Icon className="h-4 w-4 text-spa-text-secondary shrink-0" aria-hidden="true" />
      <span className="text-sm font-medium text-spa-text-primary">{label}</span>
      <span className="ml-auto">{badge}</span>
    </div>
  );
}

export function SystemChecksWidget({
  backendStatus,
  backendTone,
  dataTone,
  websocketTone,
  wsConnected,
  updateTone,
  isAdmin,
  updateLabel,
  runtimeStatus,
}: SystemChecksWidgetProps) {
  const warnings = runtimeStatus?.warnings || [];
  const maintenance = runtimeStatus?.maintenance;
  const devices = runtimeStatus?.devices ?? null;
  const maintenanceBadge = maintenance ? getMaintenanceBadge(maintenance.state) : null;

  const hasWarnings = warnings.length > 0;
  const [detailOpen, setDetailOpen] = useState(hasWarnings);

  // Render-phase auto-open: wenn nach dem Mount Warnungen reinkommen
  // (typisch: runtimeStatus pollt alle 30 s und liefert beim ersten
  // Mount noch null), klappen wir die Details automatisch auf. Ein
  // tracked Vorgängerwert verhindert, dass wir den User wieder
  // aufzwingen, falls er manuell zugeklappt hat — wir reagieren nur
  // auf den Übergang false→true. Nach dem React-Linter ist das die
  // korrekte Form (kein setState-in-effect).
  const [prevHadWarnings, setPrevHadWarnings] = useState(hasWarnings);
  if (hasWarnings && !prevHadWarnings) {
    setPrevHadWarnings(true);
    setDetailOpen(true);
  } else if (!hasWarnings && prevHadWarnings) {
    setPrevHadWarnings(false);
  }

  // Tone-Heuristik für die Geräte-Tiles: Pending/Stale/NeverSeen sind
  // Aufmerksamkeitsbedürftig, sobald > 0; Online ist „success" wenn
  // welche da sind.
  const onlineTone: 'neutral' | 'success' = devices && devices.online > 0 ? 'success' : 'neutral';
  const offlineTone: 'neutral' | 'warning' = devices && devices.offline > 0 ? 'warning' : 'neutral';
  const staleTone: 'neutral' | 'warning' | 'danger' = !devices
    ? 'neutral'
    : devices.stale > 0
      ? devices.stale > 2 ? 'danger' : 'warning'
      : 'neutral';
  const pendingTone: 'neutral' | 'warning' = devices && devices.pending > 0 ? 'warning' : 'neutral';

  return (
    <DashboardWidgetFrame
      title="System-Checks"
      description="Verbindungen, Geräte-Bilanz und Wartung im Blick."
      icon={Activity}
      actions={(
        <Link
          to="/settings"
          className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
        >
          Zum System
        </Link>
      )}
    >
      {/* Verbindungsstatus — kompakte Zeilen mit Icons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ConnectivityRow
          icon={Globe}
          label="Backend API"
          badge={<StatusBadge label={backendStatus === 'ok' ? 'OK' : 'Fehler'} tone={backendTone} />}
        />
        <ConnectivityRow
          icon={Database}
          label="Datenbasis"
          badge={<StatusBadge label={dataTone === 'success' ? 'Konsistent' : 'Prüfen'} tone={dataTone} />}
        />
        <ConnectivityRow
          icon={Wifi}
          label="WebSocket"
          badge={
            <StatusBadge
              label={wsConnected ? 'Verbunden' : 'Getrennt'}
              tone={websocketTone}
              pulse={wsConnected}
            />
          }
        />
        {isAdmin && (
          <ConnectivityRow
            icon={RefreshCw}
            label="Systemupdate"
            badge={<StatusBadge label={updateLabel} tone={updateTone} />}
          />
        )}
      </div>

      {/* Details-Toggle */}
      <div className="mt-4 border-t border-spa-bg-secondary pt-3">
        <button
          type="button"
          onClick={() => setDetailOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold text-spa-text-secondary transition-colors hover:text-spa-text-primary"
          aria-expanded={detailOpen}
          aria-controls="system-checks-details"
        >
          <span className="inline-flex items-center gap-2">
            Details
            {hasWarnings && (
              <span className="inline-flex items-center gap-1 rounded-full bg-spa-warning-light px-1.5 py-0.5 text-[10px] font-bold uppercase text-spa-warning-dark">
                <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
                {warnings.length}
              </span>
            )}
          </span>
          <ChevronDown
            className={clsx('h-4 w-4 transition-transform', detailOpen && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      {detailOpen && (
        <div id="system-checks-details" className="mt-3 space-y-4">
          {/* Geräte-Bilanz aus runtimeStatus.devices */}
          {devices && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-spa-text-secondary flex items-center gap-1.5">
                  <MonitorCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Geräte-Bilanz
                </p>
                <span className="text-[11px] text-spa-text-secondary">
                  {devices.total} gesamt
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Online" value={devices.online} tone={onlineTone} />
                <StatTile label="Offline" value={devices.offline} tone={offlineTone} />
                <StatTile label="Wartend" value={devices.pending} tone={pendingTone} />
                <StatTile label="Überfällig" value={devices.stale} tone={staleTone} />
              </div>
              {devices.neverSeen > 0 && (
                <p className="mt-2 text-[11px] text-spa-text-secondary">
                  <span className="font-semibold">{devices.neverSeen}</span> gepairtes Gerät noch nie gesehen — vermutlich neu hinzugefügt.
                </p>
              )}
            </div>
          )}

          {/* Housekeeping */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-spa-text-secondary flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                Housekeeping
              </p>
              {maintenanceBadge ? (
                <StatusBadge label={maintenanceBadge.label} tone={maintenanceBadge.tone} />
              ) : (
                <StatusBadge label="Lädt" tone="neutral" />
              )}
            </div>
            {maintenance ? (
              <div className="rounded-xl border border-spa-bg-secondary bg-spa-bg-primary/40 p-3 space-y-1.5">
                <p className="text-xs text-spa-text-secondary">
                  Letzter Lauf:{' '}
                  <span className="font-semibold text-spa-text-primary">
                    {maintenance.lastRunAt
                      ? formatRelativeTime(toValidDate(maintenance.lastRunAt))
                      : 'noch nicht'}
                  </span>
                </p>
                {/* Bereinigungs-Counts kompakt als Inline-Chips */}
                {(() => {
                  // Single Source of Truth für die Bereinigungs-Counts —
                  // sowohl die Chip-Liste als auch der Idle-Hinweis lesen
                  // dasselbe Array. Verhindert Drift, wenn die Maintenance-
                  // Felder erweitert werden (z. B. neues Counter-Feld
                  // hinzukommt und in einer der beiden Stellen vergessen
                  // wird).
                  const cleanupCounts = [
                    { label: 'Sessions', value: maintenance.deletedExpiredSessions },
                    { label: 'Uploads', value: maintenance.removedOrphanUploadFiles },
                    { label: 'Snapshots', value: maintenance.removedStaleDeviceSnapshots },
                    { label: 'Audit', value: maintenance.removedExpiredAuditLogs },
                    { label: 'Backups', value: maintenance.removedOldBackupFiles },
                    { label: 'Logs alt', value: maintenance.removedOldLogFiles },
                    { label: 'Logs gekürzt', value: maintenance.trimmedLargeLogFiles },
                  ];
                  const activeChips = cleanupCounts.filter((chip) => chip.value > 0);
                  return (
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      {activeChips.map((chip) => (
                        <span
                          key={chip.label}
                          className="inline-flex items-center gap-1 rounded-full bg-spa-surface px-2 py-0.5 text-spa-text-secondary border border-spa-bg-secondary"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 text-spa-success" aria-hidden="true" />
                          <span className="font-semibold text-spa-text-primary tabular-nums">{chip.value}</span>
                          {chip.label}
                        </span>
                      ))}
                      {activeChips.length === 0 && (
                        <span className="text-spa-text-secondary">Nichts zu bereinigen.</span>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-spa-text-secondary">Wartungsstatus wird geladen.</p>
            )}
          </div>

          {/* Laufzeitwarnungen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-spa-text-secondary flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Laufzeitwarnungen
              </p>
              <span className="text-[11px] text-spa-text-secondary">
                {warnings.length > 0 ? `${warnings.length} aktiv` : 'Keine'}
              </span>
            </div>

            {warnings.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 overscroll-contain">
                {warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={clsx(
                      'rounded-lg border px-3 py-2',
                      warning.level === 'danger'
                        ? 'border-spa-error/30 bg-spa-error-light/60'
                        : 'border-spa-warning/30 bg-spa-warning-light/70',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold text-spa-text-primary truncate">
                        {warning.title}
                      </p>
                      <StatusBadge
                        label={getCategoryLabel(warning.category)}
                        tone={warning.level === 'danger' ? 'danger' : 'warning'}
                        showDot={false}
                      />
                    </div>
                    <p className="text-xs text-spa-text-secondary leading-relaxed">
                      {warning.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-spa-success/30 bg-spa-success-light/60 px-3 py-2 text-xs text-spa-success-dark">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Keine akuten Speicher-, Medien- oder Heartbeat-Warnungen erkannt.
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardWidgetFrame>
  );
}
