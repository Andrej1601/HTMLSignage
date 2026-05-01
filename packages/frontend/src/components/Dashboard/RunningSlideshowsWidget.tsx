/**
 * Geräte-Übersicht — vereinte Sicht auf gekoppelte Displays:
 * Snapshot, aktuelle Slideshow, letzter Sync und Health-Status pro Gerät.
 *
 * Das Layout der Tabelle bleibt unverändert; ergänzt wurden:
 *  - Aggregat-Status in der Beschreibung („3 von 4 Geräten online").
 *  - Quick-Action „Alle neu laden" in der Action-Leiste.
 *  - Reicheres Status-Signal: green/yellow/red/muted (Heartbeat + Wartung)
 *    statt der vorherigen Binär-Anzeige.
 *  - Wartungsmodus-Icon direkt neben dem Gerätenamen.
 */
import { Link } from 'react-router-dom';
import { Monitor, MonitorSmartphone, RefreshCw, Wrench } from 'lucide-react';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import { Button } from '@/components/Button';
import { useBulkSendCommand } from '@/hooks/useDevices';
import type { DeviceSlideshowRow } from '@/hooks/dashboardData.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { formatRelativeTime } from '@/utils/dateUtils';
import clsx from 'clsx';

type HealthLevel = 'green' | 'yellow' | 'red' | 'muted';

interface DeviceHealth {
  level: HealthLevel;
  label: string;
  description: string;
}

/**
 * Health-Klassifizierung — etwas konservativer als der einfache 5-Min-
 * Check, der den `isOnline`-Flag steuert. Wir möchten unter „yellow"
 * auch Geräte fangen, die zwischen 5 und 30 Minuten still sind, und
 * Wartungsmodus separat markieren.
 */
function classifyRow(row: DeviceSlideshowRow): DeviceHealth {
  if (row.neverSeen) {
    return { level: 'muted', label: 'Neu', description: 'Noch nie verbunden' };
  }
  const ageMinutes = row.lastSeen
    ? (Date.now() - new Date(row.lastSeen).getTime()) / 60_000
    : Infinity;

  if (ageMinutes > 30 || Number.isNaN(ageMinutes)) {
    return {
      level: 'red',
      label: 'Offline',
      description: row.lastSeen
        ? `Offline seit ${formatRelativeTime(new Date(row.lastSeen))}`
        : 'Offline',
    };
  }
  if (row.maintenanceMode) {
    return { level: 'yellow', label: 'Wartung', description: 'Wartungsmodus aktiv' };
  }
  if (ageMinutes > 5) {
    return {
      level: 'yellow',
      label: 'Verzögert',
      description: row.lastSeen
        ? `Letzter Heartbeat ${formatRelativeTime(new Date(row.lastSeen))}`
        : 'Heartbeat verzögert',
    };
  }
  return { level: 'green', label: 'Online', description: 'Läuft normal' };
}

const STATUS_DOT: Record<HealthLevel, string> = {
  green: 'bg-spa-success',
  yellow: 'bg-spa-warning',
  red: 'bg-spa-error',
  muted: 'bg-spa-text-secondary/50',
};

interface RunningSlideshowsWidgetProps {
  rows: DeviceSlideshowRow[];
}

export function RunningSlideshowsWidget({ rows }: RunningSlideshowsWidgetProps) {
  const bulkSend = useBulkSendCommand();

  // Aggregat: Health-Klassifizierung pro Zeile, Counts für die Beschreibung.
  const classified = rows.map((row) => ({ row, health: classifyRow(row) }));
  const counts = classified.reduce(
    (acc, { health }) => {
      acc[health.level] = (acc[health.level] ?? 0) + 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, muted: 0 } as Record<HealthLevel, number>,
  );
  const totalOnline = counts.green + counts.yellow;

  const description =
    rows.length === 0
      ? undefined
      : `${totalOnline} von ${rows.length} Gerät${rows.length === 1 ? '' : 'en'} erreichbar` +
        (counts.red > 0 ? ` · ${counts.red} offline` : '') +
        (counts.yellow > 0 ? ` · ${counts.yellow} mit Hinweis` : '') +
        (counts.muted > 0 ? ` · ${counts.muted} neu` : '');

  const handleReloadAll = () => {
    if (rows.length === 0) return;
    bulkSend.mutate({
      deviceIds: rows.map((r) => r.deviceId),
      command: { action: 'reload' },
    });
  };

  return (
    <DashboardWidgetFrame
      title="Geräte-Übersicht"
      description={description}
      icon={MonitorSmartphone}
      actions={(
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={handleReloadAll}
            loading={bulkSend.isPending}
            loadingText="Sendet..."
            disabled={rows.length === 0}
          >
            Alle neu laden
          </Button>
          <Link
            to="/devices"
            className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
          >
            Alle Geräte
          </Link>
        </>
      )}
    >
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-spa-text-secondary">
          Keine Geräte gekoppelt.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-spa-bg-secondary text-left text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
                <th className="pb-3 pr-4">Gerätename</th>
                <th className="pb-3 pr-4">Geräte-Snapshot</th>
                <th className="pb-3 pr-4">Aktive Slideshow</th>
                <th className="pb-3 pr-4">Slides</th>
                <th className="pb-3 pr-4">Letzter Sync</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-spa-bg-secondary/60">
              {classified.map(({ row, health }) => (
                <tr key={row.deviceId} className="transition-colors hover:bg-spa-bg-primary/50">
                  {/* Gerätename — ergänzt um Wartungs-Icon, falls aktiv */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-spa-text-primary">{row.deviceName}</span>
                      {row.maintenanceMode && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded-full bg-spa-warning-light px-1.5 py-0.5 text-[10px] font-bold text-spa-warning-dark"
                          title="Wartungsmodus aktiv"
                          aria-label="Wartungsmodus aktiv"
                        >
                          <Wrench className="h-2.5 w-2.5" aria-hidden="true" />
                          Wartung
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-spa-text-secondary">ID: {row.deviceId}</div>
                  </td>

                  {/* Geräte-Snapshot */}
                  <td className="py-3 pr-4">
                    <div className="h-10 w-16 overflow-hidden rounded-md border border-spa-bg-secondary bg-spa-bg-primary">
                      {row.snapshotUrl ? (
                        <img
                          src={toAbsoluteMediaUrl(row.snapshotUrl)}
                          alt={`Snapshot ${row.deviceName}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Monitor className="h-4 w-4 text-spa-text-secondary/40" />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Aktive Slideshow */}
                  <td className="py-3 pr-4 text-spa-text-primary">
                    {row.slideshowTitle}
                  </td>

                  {/* Slides (clickable badge → Slideshow editor) */}
                  <td className="py-3 pr-4">
                    <Link
                      to={`/slideshow?target=${encodeURIComponent(row.editorTarget)}`}
                      className="inline-flex min-w-[2rem] items-center justify-center rounded-md bg-spa-primary/10 px-2 py-0.5 text-xs font-semibold text-spa-primary transition-colors hover:bg-spa-primary/20"
                    >
                      {row.slideCount}
                    </Link>
                  </td>

                  {/* Letzter Sync */}
                  <td className="py-3 pr-4 text-spa-text-secondary">
                    {row.lastSeen
                      ? formatRelativeTime(new Date(row.lastSeen))
                      : 'Nie gesehen'}
                  </td>

                  {/* Status — Health-Dot mit Tooltip; Layout unverändert */}
                  <td className="py-3">
                    <span
                      className={clsx('inline-block h-2.5 w-2.5 rounded-full', STATUS_DOT[health.level])}
                      title={`${health.label} – ${health.description}`}
                      aria-label={`${health.label} – ${health.description}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardWidgetFrame>
  );
}
