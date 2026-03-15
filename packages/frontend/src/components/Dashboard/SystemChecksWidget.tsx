import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, HardDrive, Wrench } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import type { SystemRuntimeStatusResponse } from '@/services/api';
import { formatFileSize } from '@/types/media.types';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';

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
  const maintenanceBadge = maintenance ? getMaintenanceBadge(maintenance.state) : null;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System-Checks
        </h3>
        <Link
          to="/settings"
          className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
        >
          Zum System
        </Link>
      </div>

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

      <div className="mt-5 pt-4 border-t border-spa-bg-secondary space-y-3">
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
                  <span className="font-semibold text-spa-text-primary"> {maintenance.removedOrphanUploadFiles}</span> Uploads
                </p>
              </div>
            ) : (
              <p className="text-xs text-spa-text-secondary">Wartungsstatus wird geladen.</p>
            )}
          </div>
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
    </div>
  );
}
