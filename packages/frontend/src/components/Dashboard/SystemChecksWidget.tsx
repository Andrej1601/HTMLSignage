import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ChevronDown, HardDrive, Wrench } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import type { SystemRuntimeHistoryResponse, SystemRuntimeStatusResponse } from '@/services/api';
import { formatFileSize } from '@/types/media.types';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import {
  RuntimeHistoryDetailDialog,
  type RuntimeHistoryDetailMetric,
} from '@/components/Dashboard/RuntimeHistoryDetailDialog';

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
  runtimeHistory: SystemRuntimeHistoryResponse | null;
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

function getDiskTone(usagePercent: number): StatusTone {
  if (usagePercent >= 95) return 'danger';
  if (usagePercent >= 85) return 'warning';
  return 'success';
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

function getDeltaTone(delta: number, positiveIsGood: boolean): string {
  if (delta === 0) return 'text-spa-text-secondary';
  const improved = positiveIsGood ? delta > 0 : delta < 0;
  return improved ? 'text-spa-success-dark' : 'text-spa-error-dark';
}

function formatSignedValue(delta: number, suffix = ''): string {
  if (delta === 0) return `0${suffix}`;
  return `${delta > 0 ? '+' : ''}${delta}${suffix}`;
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
  runtimeHistory,
}: SystemChecksWidgetProps) {
  const [selectedHistoryMetric, setSelectedHistoryMetric] = useState<RuntimeHistoryDetailMetric | null>(null);
  const warnings = runtimeStatus?.warnings || [];
  const maintenance = runtimeStatus?.maintenance;
  const maintenanceBadge = maintenance ? getMaintenanceBadge(maintenance.state) : null;
  const historySummary = runtimeHistory?.summary || null;

  const hasWarnings = warnings.length > 0;
  const [detailOpen, setDetailOpen] = useState(hasWarnings);

  return (
    <DashboardWidgetFrame
      title="System-Checks"
      description="API, Laufzeitstatus, Speicherlage und Housekeeping im Blick."
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">Backend API</span>
          <StatusBadge
            label={backendStatus === 'ok' ? 'OK' : 'Fehler'}
            tone={backendTone}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">Datenbasis</span>
          <StatusBadge
            label={dataTone === 'success' ? 'Konsistent' : 'Prüfen'}
            tone={dataTone}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">WebSocket</span>
          <StatusBadge
            label={wsConnected ? 'Verbunden' : 'Getrennt'}
            tone={websocketTone}
            pulse={wsConnected}
          />
        </div>
        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-spa-text-secondary">Systemupdate</span>
            <StatusBadge label={updateLabel} tone={updateTone} />
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-spa-bg-secondary pt-3">
        <button
          type="button"
          onClick={() => setDetailOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm font-semibold text-spa-text-secondary transition-colors hover:text-spa-text-primary"
        >
          <span>Details {hasWarnings ? `(${warnings.length} Warnungen)` : ''}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${detailOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {detailOpen && (
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-spa-bg-primary p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5" />
                Speicher
              </p>
              {runtimeStatus ? (
                <StatusBadge
                  label={`${runtimeStatus.disk.usagePercent}% belegt`}
                  tone={getDiskTone(runtimeStatus.disk.usagePercent)}
                />
              ) : (
                <StatusBadge label="Lädt" tone="neutral" />
              )}
            </div>
            {runtimeStatus ? (
              <div className="text-xs text-spa-text-secondary space-y-1">
                <p>
                  Frei: <span className="font-semibold text-spa-text-primary">{formatFileSize(runtimeStatus.disk.availableBytes)}</span>
                </p>
                <p>
                  Medien: <span className="font-semibold text-spa-text-primary">{runtimeStatus.media.filesOnDisk}</span> Dateien
                </p>
              </div>
            ) : (
              <p className="text-xs text-spa-text-secondary">Laufzeitstatus wird geladen.</p>
            )}
          </div>

          <div className="rounded-lg bg-spa-bg-primary p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" />
                Housekeeping
              </p>
              {maintenanceBadge ? (
                <StatusBadge label={maintenanceBadge.label} tone={maintenanceBadge.tone} />
              ) : (
                <StatusBadge label="Lädt" tone="neutral" />
              )}
            </div>
            {maintenance ? (
              <div className="text-xs text-spa-text-secondary space-y-1">
                <p>
                  Letzter Lauf:{' '}
                  <span className="font-semibold text-spa-text-primary">
                    {maintenance.lastRunAt ? formatRelativeTime(toValidDate(maintenance.lastRunAt)) : 'noch nicht'}
                  </span>
                </p>
                <p>
                  Bereinigt: <span className="font-semibold text-spa-text-primary">{maintenance.deletedExpiredSessions}</span> Sessions,
                  <span className="font-semibold text-spa-text-primary"> {maintenance.removedOrphanUploadFiles}</span> Uploads,
                  <span className="font-semibold text-spa-text-primary"> {maintenance.removedStaleDeviceSnapshots}</span> Snapshots
                </p>
                <p>
                  Aufbewahrung: <span className="font-semibold text-spa-text-primary">{maintenance.removedExpiredAuditLogs}</span> Audit-Einträge,
                  <span className="font-semibold text-spa-text-primary"> {maintenance.removedOldBackupFiles}</span> Backups,
                  <span className="font-semibold text-spa-text-primary"> {maintenance.trimmedLargeLogFiles}</span> Logs gekürzt
                </p>
              </div>
            ) : (
              <p className="text-xs text-spa-text-secondary">Wartungsstatus wird geladen.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-spa-bg-primary p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">
              Verlauf letzte {runtimeHistory?.periodHours || 24}h
            </p>
            {historySummary ? (
              <span className="text-xs text-spa-text-secondary">
                {historySummary.sampleCount} Punkte
              </span>
            ) : (
              <StatusBadge label="Lädt" tone="neutral" />
            )}
          </div>

          {historySummary && historySummary.sampleCount > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setSelectedHistoryMetric('heartbeats')}
                className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-3 text-left transition-all hover:border-spa-primary/40 hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-spa-primary/30"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                  Heartbeats
                </p>
                <p className="mt-1 text-lg font-semibold text-spa-text-primary">
                  Ø {historySummary.avgOnlineDevices}
                </p>
                <p className="text-xs text-spa-text-secondary">
                  Max. {historySummary.maxStaleDevices} überfällig
                </p>
                <p className={`mt-2 text-xs font-semibold ${getDeltaTone(historySummary.deltas.staleDevices, false)}`}>
                  Überfällig {formatSignedValue(historySummary.deltas.staleDevices)}
                </p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-spa-primary">
                  Details öffnen
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHistoryMetric('warnings')}
                className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-3 text-left transition-all hover:border-spa-primary/40 hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-spa-primary/30"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                  Warnlagen
                </p>
                <p className="mt-1 text-lg font-semibold text-spa-text-primary">
                  Peak {historySummary.maxSystemWarningCount}
                </p>
                <p className="text-xs text-spa-text-secondary">
                  Aktiver Verlauf seit {historySummary.coverageHours}h · ohne Heartbeats
                </p>
                <p className={`mt-2 text-xs font-semibold ${getDeltaTone(historySummary.deltas.systemWarningCount, false)}`}>
                  Warnungen {formatSignedValue(historySummary.deltas.systemWarningCount)}
                </p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-spa-primary">
                  Details öffnen
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedHistoryMetric('disk')}
                className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-3 text-left transition-all hover:border-spa-primary/40 hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-spa-primary/30"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                  Speichertrend
                </p>
                <p className="mt-1 text-lg font-semibold text-spa-text-primary">
                  Peak {historySummary.maxDiskUsagePercent}%
                </p>
                <p className="text-xs text-spa-text-secondary">
                  Letzte Probe {historySummary.lastPointAt ? formatRelativeTime(toValidDate(historySummary.lastPointAt)) : 'unbekannt'}
                </p>
                <p className={`mt-2 text-xs font-semibold ${getDeltaTone(historySummary.deltas.diskUsagePercent, false)}`}>
                  Speicher {formatSignedValue(historySummary.deltas.diskUsagePercent, '%')}
                </p>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-spa-primary">
                  Details öffnen
                </p>
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-spa-bg-secondary bg-spa-surface px-3 py-3 text-xs text-spa-text-secondary">
              Noch nicht genug Verlaufsdaten vorhanden. Die Historie füllt sich im laufenden Betrieb automatisch.
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold text-spa-text-primary flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Laufzeitwarnungen
            </p>
            <span className="text-xs text-spa-text-secondary">
              {warnings.length > 0 ? `${warnings.length} aktiv` : 'Keine aktiven Warnungen'}
            </span>
          </div>

          {warnings.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 overscroll-contain">
              {warnings.map((warning) => (
                <div
                  key={warning.id}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: warning.level === 'danger' ? 'rgba(220,38,38,0.18)' : 'rgba(217,119,6,0.18)',
                    backgroundColor: warning.level === 'danger' ? 'rgba(254,242,242,0.75)' : 'rgba(255,251,235,0.75)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-spa-text-primary">{warning.title}</p>
                    <StatusBadge
                      label={getCategoryLabel(warning.category)}
                      tone={warning.level === 'danger' ? 'danger' : 'warning'}
                      showDot={false}
                    />
                  </div>
                  <p className="text-xs text-spa-text-secondary leading-relaxed">{warning.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary px-3 py-2 text-xs text-spa-text-secondary">
              Keine akuten Speicher-, Medien- oder Heartbeat-Warnungen erkannt.
            </div>
          )}
        </div>
      </div>
      )}

      <RuntimeHistoryDetailDialog
        metric={selectedHistoryMetric}
        runtimeHistory={runtimeHistory}
        runtimeStatus={runtimeStatus}
        onClose={() => setSelectedHistoryMetric(null)}
      />
    </DashboardWidgetFrame>
  );
}
