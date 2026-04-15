import { Link } from 'react-router-dom';
import { Monitor, Presentation } from 'lucide-react';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import type { DeviceSlideshowRow } from '@/hooks/dashboardData.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { formatRelativeTime } from '@/utils/dateUtils';

interface RunningSlideshowsWidgetProps {
  rows: DeviceSlideshowRow[];
}

export function RunningSlideshowsWidget({ rows }: RunningSlideshowsWidgetProps) {
  return (
    <DashboardWidgetFrame
      title="Laufende Slideshows"
      icon={Presentation}
      actions={
        <Link
          to="/slideshow"
          className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
        >
          Alle ansehen
        </Link>
      }
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
              {rows.map((row) => (
                <tr key={row.deviceId} className="transition-colors hover:bg-spa-bg-primary/50">
                  {/* Gerätename */}
                  <td className="py-3 pr-4">
                    <div className="font-medium text-spa-text-primary">{row.deviceName}</div>
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

                  {/* Status */}
                  <td className="py-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        row.isOnline ? 'bg-spa-success' : 'bg-spa-warning'
                      }`}
                      title={row.isOnline ? 'Online' : 'Offline'}
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
