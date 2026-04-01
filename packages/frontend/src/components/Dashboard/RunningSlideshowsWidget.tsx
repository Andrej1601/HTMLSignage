import { Link } from 'react-router-dom';
import { Presentation, Monitor } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';
import type { RunningSlideshowGroup } from '@/hooks/dashboardData.types';

interface RunningSlideshowsWidgetProps {
  runningSlideshows: RunningSlideshowGroup[];
}

export function RunningSlideshowsWidget({ runningSlideshows }: RunningSlideshowsWidgetProps) {
  return (
    <DashboardWidgetFrame
      title="Laufende Slideshows"
      description="Aktuell ausgespielte Slideshows und zugeordnete Geräte."
      icon={Presentation}
      actions={
        <Link
          to="/slideshow"
          className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
        >
          Zum Editor
        </Link>
      }
    >
      {runningSlideshows.length === 0 ? (
        <p className="py-4 text-center text-sm text-spa-text-secondary">
          Keine Slideshows aktiv.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-spa-bg-secondary text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary">
                <th className="pb-3 pr-4">Slideshow</th>
                <th className="pb-3 pr-4">Quelle</th>
                <th className="pb-3 pr-4">Slides</th>
                <th className="pb-3">Geräte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-spa-bg-secondary/60">
              {runningSlideshows.map((group) => (
                <tr key={group.id} className="hover:bg-spa-bg-primary/50 transition-colors">
                  <td className="py-3 pr-4 font-medium text-spa-text-primary">
                    {group.title}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge
                      label={group.source === 'global' ? 'Global' : 'Override'}
                      tone={group.source === 'global' ? 'info' : 'warning'}
                    />
                  </td>
                  <td className="py-3 pr-4 text-spa-text-secondary">
                    {group.slides.length}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {group.deviceNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 rounded-md bg-spa-bg-secondary px-2 py-0.5 text-xs font-medium text-spa-text-secondary"
                        >
                          <Monitor className="h-3 w-3" />
                          {name}
                        </span>
                      ))}
                    </div>
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
