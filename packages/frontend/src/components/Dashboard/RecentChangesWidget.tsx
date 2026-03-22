import { Clock } from 'lucide-react';
import { DashboardWidgetFrame } from './DashboardWidgetFrame';
import { StatusBadge } from '@/components/StatusBadge';
import { formatRelativeTime } from '@/utils/dateUtils';
import type { ActivityItem } from './ActivityFeedWidget';

interface RecentChangesWidgetProps {
  items: ActivityItem[];
  maxItems?: number;
}

export function RecentChangesWidget({ items, maxItems = 5 }: RecentChangesWidgetProps) {
  const recent = items
    .filter((item) => item.timestamp)
    .sort((a, b) => (b.timestamp!.getTime() - a.timestamp!.getTime()))
    .slice(0, maxItems);

  return (
    <DashboardWidgetFrame title="Letzte Änderungen" icon={Clock}>
      {recent.length === 0 ? (
        <p className="text-sm text-spa-text-secondary py-4 text-center">
          Noch keine Aktivitäten erfasst.
        </p>
      ) : (
        <div className="divide-y divide-spa-bg-secondary/60">
          {recent.map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <StatusBadge label="" tone={item.tone} showDot className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-spa-text-primary truncate">
                  {item.title}
                </p>
                <p className="text-xs text-spa-text-secondary truncate">
                  {item.description}
                </p>
              </div>
              {item.timestamp && (
                <span className="text-[11px] text-spa-text-secondary/70 flex-shrink-0 whitespace-nowrap">
                  {formatRelativeTime(item.timestamp)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardWidgetFrame>
  );
}
