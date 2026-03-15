import { useMemo } from 'react';
import { Activity, AlertTriangle, HardDrive } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import type { SystemRuntimeHistoryPoint, SystemRuntimeHistoryResponse, SystemRuntimeStatusResponse } from '@/services/api';
import { formatFileSize } from '@/types/media.types';
import { formatRelativeTime, toValidDate } from '@/utils/dateUtils';

export type RuntimeHistoryDetailMetric = 'heartbeats' | 'warnings' | 'disk';

interface RuntimeHistoryDetailDialogProps {
  metric: RuntimeHistoryDetailMetric | null;
  runtimeHistory: SystemRuntimeHistoryResponse | null;
  runtimeStatus: SystemRuntimeStatusResponse | null;
  onClose: () => void;
}

interface DetailStat {
  label: string;
  value: string;
  hint?: string;
  tone?: StatusTone;
}

interface DetailSample {
  id: string;
  timestamp: string;
  value: string;
  detail: string;
  badge?: {
    label: string;
    tone: StatusTone;
  };
}

interface RuntimeHistoryDetailView {
  title: string;
  description: string;
  chartLabel: string;
  stats: DetailStat[];
  insights: string[];
  samples: DetailSample[];
  chartValues: number[];
  chartTone: StatusTone;
  currentWarnings: SystemRuntimeStatusResponse['warnings'];
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value: string | null | undefined): string {
  const date = toValidDate(value);
  return date ? DATE_TIME_FORMAT.format(date) : 'Unbekannt';
}

function formatMaintenanceState(state: SystemRuntimeHistoryPoint['maintenanceState']): {
  label: string;
  tone: StatusTone;
} {
  switch (state) {
    case 'running':
      return { label: 'Wartung läuft', tone: 'info' };
    case 'ok':
      return { label: 'Wartung OK', tone: 'success' };
    case 'error':
      return { label: 'Wartung Fehler', tone: 'danger' };
    default:
      return { label: 'Wartung wartet', tone: 'warning' };
  }
}

function formatSignedNumber(value: number, suffix = ''): string {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

function getDeltaTone(delta: number, positiveIsGood: boolean): StatusTone {
  if (delta === 0) return 'neutral';
  const improved = positiveIsGood ? delta > 0 : delta < 0;
  return improved ? 'success' : 'danger';
}

function getStatToneClasses(tone: StatusTone = 'neutral'): string {
  switch (tone) {
    case 'success':
      return 'border-spa-success/20 bg-spa-success-light/40';
    case 'warning':
      return 'border-spa-warning/20 bg-spa-warning-light/40';
    case 'danger':
      return 'border-spa-error/20 bg-spa-error-light/40';
    case 'info':
      return 'border-spa-primary/20 bg-spa-primary-light/40';
    default:
      return 'border-spa-bg-secondary bg-white';
  }
}

function getChartToneClass(tone: StatusTone): string {
  switch (tone) {
    case 'success':
      return 'bg-spa-success';
    case 'warning':
      return 'bg-spa-warning';
    case 'danger':
      return 'bg-spa-error';
    case 'info':
      return 'bg-spa-primary';
    default:
      return 'bg-spa-text-secondary';
  }
}

function buildEmptyView(currentWarnings: SystemRuntimeStatusResponse['warnings']): RuntimeHistoryDetailView {
  return {
    title: 'Verlauf',
    description: 'Noch nicht genug Verlaufsdaten vorhanden.',
    chartLabel: 'Noch keine Historie',
    stats: [],
    insights: ['Die Historie füllt sich im laufenden Betrieb automatisch.'],
    samples: [],
    chartValues: [],
    chartTone: 'neutral',
    currentWarnings,
  };
}

function buildHeartbeatsView(
  points: SystemRuntimeHistoryPoint[],
  runtimeHistory: SystemRuntimeHistoryResponse | null,
  runtimeStatus: SystemRuntimeStatusResponse | null,
): RuntimeHistoryDetailView {
  const summary = runtimeHistory?.summary;
  const latest = points[points.length - 1] || null;
  const peakStalePoint = points.reduce<SystemRuntimeHistoryPoint | null>((peak, point) => {
    if (!peak || point.staleDevices > peak.staleDevices) return point;
    return peak;
  }, null);
  const minOnline = points.reduce((min, point) => Math.min(min, point.onlineDevices), points[0]?.onlineDevices ?? 0);

  return {
    title: 'Heartbeat-Verlauf',
    description: 'Zeigt, wie stabil die Displays in den letzten 24 Stunden Heartbeats gesendet haben.',
    chartLabel: 'Online-Geräte je Probe',
    stats: [
      {
        label: 'Aktuell online',
        value: latest ? `${latest.onlineDevices} / ${latest.pairedDevices}` : `${runtimeStatus?.devices.online ?? 0}`,
        hint: latest ? `${latest.offlineDevices} offline · ${latest.staleDevices} überfällig` : 'Keine aktuelle Probe',
        tone: latest && latest.staleDevices > 0 ? 'warning' : 'success',
      },
      {
        label: 'Durchschnitt online',
        value: `${summary?.avgOnlineDevices ?? 0}`,
        hint: `Minimum ${minOnline} online`,
        tone: 'info',
      },
      {
        label: 'Peak überfällig',
        value: `${summary?.maxStaleDevices ?? 0}`,
        hint: peakStalePoint ? formatDateTime(peakStalePoint.timestamp) : 'Keine Probe',
        tone: (summary?.maxStaleDevices ?? 0) > 0 ? 'warning' : 'success',
      },
      {
        label: 'Trend überfällig',
        value: formatSignedNumber(summary?.deltas.staleDevices ?? 0),
        hint: 'Vergleich erste zu letzter Probe',
        tone: getDeltaTone(summary?.deltas.staleDevices ?? 0, false),
      },
    ],
    insights: [
      latest
        ? `${latest.pairedDevices} gekoppelte Geräte wurden im letzten Snapshot bewertet.`
        : 'Es liegt noch kein letzter Heartbeat-Snapshot vor.',
      (summary?.maxStaleDevices ?? 0) > 0
        ? `Mindestens einmal gab es ${summary?.maxStaleDevices} überfällige Geräte.`
        : 'Im ausgewerteten Zeitraum gab es keine überfälligen Geräte.',
      (summary?.deltas.staleDevices ?? 0) > 0
        ? 'Die Zahl verspäteter Heartbeats ist zuletzt gestiegen.'
        : (summary?.deltas.staleDevices ?? 0) < 0
          ? 'Die Heartbeat-Lage hat sich zuletzt verbessert.'
          : 'Die Lage der überfälligen Geräte ist zwischen erster und letzter Probe unverändert.',
    ],
    samples: points.slice(-8).reverse().map((point) => ({
      id: point.timestamp,
      timestamp: point.timestamp,
      value: `${point.onlineDevices} online`,
      detail: `${point.offlineDevices} offline · ${point.staleDevices} überfällig · ${point.neverSeenDevices} ohne Heartbeat`,
      badge: point.staleDevices > 0
        ? { label: 'Überfällig', tone: point.staleDevices >= 2 ? 'danger' : 'warning' }
        : { label: 'Stabil', tone: 'success' },
    })),
    chartValues: points.slice(-12).map((point) => point.onlineDevices),
    chartTone: 'info',
    currentWarnings: runtimeStatus?.warnings || [],
  };
}

function buildWarningsView(
  points: SystemRuntimeHistoryPoint[],
  runtimeHistory: SystemRuntimeHistoryResponse | null,
  runtimeStatus: SystemRuntimeStatusResponse | null,
): RuntimeHistoryDetailView {
  const summary = runtimeHistory?.summary;
  const currentWarnings = (runtimeStatus?.warnings || []).filter((warning) => warning.category !== 'devices');
  const latest = points[points.length - 1] || null;
  const activeSamples = points.filter((point) => point.systemWarningCount > 0).length;
  const activeRatio = points.length > 0 ? Math.round((activeSamples / points.length) * 100) : 0;
  const peakWarningPoint = points.reduce<SystemRuntimeHistoryPoint | null>((peak, point) => {
    if (!peak || point.systemWarningCount > peak.systemWarningCount) return point;
    return peak;
  }, null);

  return {
    title: 'Warnlagen-Verlauf',
    description: 'Zeigt zusätzliche Systemwarnungen im Zeitraum, ohne Geräte-Heartbeat-Themen noch einmal mitzuzählen.',
    chartLabel: 'Systemwarnungen je Probe',
    stats: [
      {
        label: 'Aktuell aktiv',
        value: `${latest?.systemWarningCount ?? currentWarnings.length}`,
        hint: currentWarnings.length ? 'Aktive zusätzliche Systemwarnungen vorhanden' : 'Keine aktive Systemwarnung',
        tone: (latest?.systemWarningCount ?? currentWarnings.length) > 0 ? 'warning' : 'success',
      },
      {
        label: 'Peak-Warnungen',
        value: `${summary?.maxSystemWarningCount ?? 0}`,
        hint: peakWarningPoint ? formatDateTime(peakWarningPoint.timestamp) : 'Keine Probe',
        tone: (summary?.maxSystemWarningCount ?? 0) > 0 ? 'warning' : 'success',
      },
      {
        label: 'Warnlast',
        value: `${activeRatio}%`,
        hint: `${activeSamples} von ${points.length} Proben mit zusätzlichen Warnungen`,
        tone: activeRatio >= 50 ? 'warning' : activeRatio > 0 ? 'info' : 'success',
      },
      {
        label: 'Trend',
        value: formatSignedNumber(summary?.deltas.systemWarningCount ?? 0),
        hint: 'Vergleich erste zu letzter Probe',
        tone: getDeltaTone(summary?.deltas.systemWarningCount ?? 0, false),
      },
    ],
    insights: [
      (summary?.maxSystemWarningCount ?? 0) === 0
        ? 'Im gesamten ausgewerteten Zeitraum gab es keine zusätzlichen Systemwarnungen.'
        : `Die höchste zusätzliche Warnlast lag bei ${summary?.maxSystemWarningCount} gleichzeitigen Warnungen.`,
      activeSamples > 0
        ? `${activeSamples} Proben hatten mindestens eine Warnung.`
        : 'Keine der gespeicherten Proben enthielt eine Warnung.',
      runtimeStatus?.maintenance.state === 'error'
        ? 'Der letzte Housekeeping-Lauf steht aktuell selbst auf Fehler.'
        : 'Heartbeat-Themen laufen separat über „Überfällig“ und werden hier bewusst ausgeblendet.',
    ],
    samples: points.slice(-8).reverse().map((point) => {
      const maintenance = formatMaintenanceState(point.maintenanceState);
      return {
        id: point.timestamp,
        timestamp: point.timestamp,
        value: `${point.systemWarningCount} Warnungen`,
        detail: maintenance.label,
        badge: point.systemWarningCount > 0
          ? { label: 'Aktiv', tone: point.systemWarningCount >= 2 ? 'danger' : 'warning' }
          : { label: 'Ruhig', tone: 'success' },
      };
    }),
    chartValues: points.slice(-12).map((point) => point.systemWarningCount),
    chartTone: 'warning',
    currentWarnings,
  };
}

function buildDiskView(
  points: SystemRuntimeHistoryPoint[],
  runtimeHistory: SystemRuntimeHistoryResponse | null,
  runtimeStatus: SystemRuntimeStatusResponse | null,
): RuntimeHistoryDetailView {
  const summary = runtimeHistory?.summary;
  const latest = points[points.length - 1] || null;
  const minUsage = points.reduce((min, point) => Math.min(min, point.diskUsagePercent), points[0]?.diskUsagePercent ?? 0);
  const peakPoint = points.reduce<SystemRuntimeHistoryPoint | null>((peak, point) => {
    if (!peak || point.diskUsagePercent > peak.diskUsagePercent) return point;
    return peak;
  }, null);
  const currentMissing = latest?.missingMediaFiles ?? runtimeStatus?.media.missingFiles ?? 0;
  const currentOrphan = latest?.orphanMediaFiles ?? runtimeStatus?.media.orphanFiles ?? 0;

  return {
    title: 'Speichertrend',
    description: 'Zeigt Datenträgerbelegung und mediennahe Auffälligkeiten über den letzten Verlauf.',
    chartLabel: 'Belegung je Probe',
    stats: [
      {
        label: 'Aktuell belegt',
        value: `${latest?.diskUsagePercent ?? runtimeStatus?.disk.usagePercent ?? 0}%`,
        hint: `Minimum ${minUsage}% im Zeitraum`,
        tone: (latest?.diskUsagePercent ?? runtimeStatus?.disk.usagePercent ?? 0) >= 85 ? 'warning' : 'success',
      },
      {
        label: 'Peak-Belegung',
        value: `${summary?.maxDiskUsagePercent ?? 0}%`,
        hint: peakPoint ? formatDateTime(peakPoint.timestamp) : 'Keine Probe',
        tone: (summary?.maxDiskUsagePercent ?? 0) >= 85 ? 'warning' : 'info',
      },
      {
        label: 'Freier Speicher',
        value: runtimeStatus ? formatFileSize(runtimeStatus.disk.availableBytes) : 'Unbekannt',
        hint: runtimeStatus ? `${formatFileSize(runtimeStatus.disk.usedBytes)} belegt` : 'Noch keine Laufzeitdaten',
        tone: 'info',
      },
      {
        label: 'Medienstatus',
        value: `${currentMissing} fehlend`,
        hint: `${currentOrphan} verwaiste Uploads`,
        tone: currentMissing > 0 || currentOrphan > 0 ? 'warning' : 'success',
      },
    ],
    insights: [
      (summary?.deltas.diskUsagePercent ?? 0) > 0
        ? `Die Belegung ist im Zeitraum um ${formatSignedNumber(summary?.deltas.diskUsagePercent ?? 0, '%')} gestiegen.`
        : (summary?.deltas.diskUsagePercent ?? 0) < 0
          ? `Die Belegung ist im Zeitraum um ${formatSignedNumber(summary?.deltas.diskUsagePercent ?? 0, '%')} gesunken.`
          : 'Die Datenträgerbelegung ist zwischen erster und letzter Probe unverändert.',
      currentMissing > 0
        ? `Aktuell fehlen ${currentMissing} referenzierte Mediendateien.`
        : 'Aktuell gibt es keine fehlenden Mediendateien im Upload-Verzeichnis.',
      currentOrphan > 0
        ? `${currentOrphan} Upload-Dateien liegen ohne DB-Referenz vor.`
        : 'Es wurden keine verwaisten Upload-Dateien erkannt.',
    ],
    samples: points.slice(-8).reverse().map((point) => ({
      id: point.timestamp,
      timestamp: point.timestamp,
        value: `${point.diskUsagePercent}% belegt`,
        detail: `${point.missingMediaFiles} fehlend · ${point.orphanMediaFiles} verwaist`,
        badge: point.diskUsagePercent >= 95
          ? { label: 'Kritisch', tone: 'danger' }
          : point.diskUsagePercent >= 85
          ? { label: 'Erhöht', tone: 'warning' }
          : { label: 'Stabil', tone: 'success' },
    })),
    chartValues: points.slice(-12).map((point) => point.diskUsagePercent),
    chartTone: 'success',
    currentWarnings: runtimeStatus?.warnings || [],
  };
}

function buildDetailView(
  metric: RuntimeHistoryDetailMetric,
  runtimeHistory: SystemRuntimeHistoryResponse | null,
  runtimeStatus: SystemRuntimeStatusResponse | null,
): RuntimeHistoryDetailView {
  const points = runtimeHistory?.points || [];
  const currentWarnings = runtimeStatus?.warnings || [];

  if (points.length === 0) {
    return buildEmptyView(currentWarnings);
  }

  switch (metric) {
    case 'heartbeats':
      return buildHeartbeatsView(points, runtimeHistory, runtimeStatus);
    case 'warnings':
      return buildWarningsView(points, runtimeHistory, runtimeStatus);
    case 'disk':
      return buildDiskView(points, runtimeHistory, runtimeStatus);
  }
}

function HistoryBars({
  values,
  tone,
}: {
  values: number[];
  tone: StatusTone;
}) {
  if (values.length === 0) return null;
  const maxValue = Math.max(...values, 1);
  const toneClass = getChartToneClass(tone);

  return (
    <div className="flex h-28 items-end gap-1 rounded-lg border border-spa-bg-secondary bg-white px-3 py-3">
      {values.map((value, index) => {
        const height = Math.max((value / maxValue) * 100, value === 0 ? 6 : 12);
        return (
          <div key={`${index}-${value}`} className="flex-1 flex items-end">
            <div
              className={`w-full rounded-t-md ${toneClass} transition-all`}
              style={{ height: `${height}%`, opacity: 0.35 + (value / maxValue) * 0.65 }}
              title={`${value}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function RuntimeHistoryDetailDialog({
  metric,
  runtimeHistory,
  runtimeStatus,
  onClose,
}: RuntimeHistoryDetailDialogProps) {
  const detailView = useMemo(() => {
    if (!metric) return null;
    return buildDetailView(metric, runtimeHistory, runtimeStatus);
  }, [metric, runtimeHistory, runtimeStatus]);

  const periodLabel = runtimeHistory ? `${runtimeHistory.periodHours}h` : '24h';

  return (
    <Dialog
      isOpen={Boolean(metric)}
      onClose={onClose}
    title={detailView?.title || 'Verlauf'}
      titleIcon={metric === 'warnings'
        ? <AlertTriangle className="w-5 h-5 text-spa-warning" />
        : metric === 'disk'
          ? <HardDrive className="w-5 h-5 text-spa-success" />
          : <Activity className="w-5 h-5 text-spa-primary" />
      }
      size="xl"
    >
      {detailView ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-spa-text-secondary leading-relaxed">
              {detailView.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-spa-text-secondary">
              <span>Verlauf: {periodLabel}</span>
              {runtimeHistory?.summary?.sampleCount ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{runtimeHistory.summary.sampleCount} Proben</span>
                  <span aria-hidden="true">•</span>
                  <span>
                    Letzte Probe {runtimeHistory.summary.lastPointAt ? formatRelativeTime(toValidDate(runtimeHistory.summary.lastPointAt)) : 'unbekannt'}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {detailView.stats.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {detailView.stats.map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-lg border px-4 py-3 ${getStatToneClasses(stat.tone)}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-spa-text-primary">
                    {stat.value}
                  </p>
                  {stat.hint ? (
                    <p className="mt-1 text-xs text-spa-text-secondary">{stat.hint}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {detailView.chartValues.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-spa-text-primary">{detailView.chartLabel}</p>
                <span className="text-xs text-spa-text-secondary">letzte {detailView.chartValues.length} Proben</span>
              </div>
              <HistoryBars values={detailView.chartValues} tone={detailView.chartTone} />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-spa-text-primary">Letzte Proben</p>
                <span className="text-xs text-spa-text-secondary">Neueste zuerst</span>
              </div>
              {detailView.samples.length > 0 ? (
                <div className="space-y-2">
                  {detailView.samples.map((sample) => (
                    <div
                      key={sample.id}
                      className="rounded-lg border border-spa-bg-secondary bg-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-spa-text-primary">{sample.value}</p>
                          <p className="text-xs text-spa-text-secondary">{sample.detail}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {sample.badge ? (
                            <StatusBadge label={sample.badge.label} tone={sample.badge.tone} />
                          ) : null}
                          <span className="text-xs text-spa-text-secondary">
                            {formatDateTime(sample.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-spa-bg-secondary bg-white px-4 py-3 text-sm text-spa-text-secondary">
                  Noch keine Verlaufspunkte vorhanden.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary px-4 py-4">
                <p className="text-sm font-semibold text-spa-text-primary">Einordnung</p>
                <div className="mt-3 space-y-2">
                  {detailView.insights.map((insight, index) => (
                    <p key={`${index}-${insight}`} className="text-sm leading-relaxed text-spa-text-secondary">
                      {insight}
                    </p>
                  ))}
                </div>
              </div>

              {metric === 'warnings' && detailView.currentWarnings.length > 0 ? (
                <div className="rounded-lg border border-spa-bg-secondary bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-spa-text-primary">Aktive Systemwarnungen jetzt</p>
                    <StatusBadge label={`${detailView.currentWarnings.length} aktiv`} tone="warning" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {detailView.currentWarnings.slice(0, 4).map((warning) => (
                      <div key={warning.id} className="rounded-lg border border-spa-warning/20 bg-spa-warning-light/30 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-spa-text-primary">{warning.title}</p>
                          <StatusBadge
                            label={warning.category === 'disk'
                              ? 'Speicher'
                              : warning.category === 'devices'
                                ? 'Geräte'
                                : warning.category === 'media'
                                  ? 'Medien'
                                  : 'Wartung'}
                            tone={warning.level === 'danger' ? 'danger' : 'warning'}
                          />
                        </div>
                        <p className="mt-1 text-xs text-spa-text-secondary">{warning.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
