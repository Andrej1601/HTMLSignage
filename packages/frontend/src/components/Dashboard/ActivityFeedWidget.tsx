import { Clock } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import { formatRelativeTime } from '@/utils/dateUtils';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  tone: StatusTone;
  timestamp?: Date;
  actor?: string;
}

interface ActivityFeedWidgetProps {
  items: ActivityItem[];
}

export function ActivityFeedWidget({ items }: ActivityFeedWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <h3 className="text-lg font-semibold text-spa-text-primary mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5" />
        Letzte Aktivitäten
      </h3>
      <div className="space-y-3 max-h-[34rem] overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="text-sm text-spa-text-secondary">Keine Aktivität verfügbar.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-spa-bg-secondary p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-spa-text-primary">{item.title}</p>
                <p className="text-sm text-spa-text-secondary mt-0.5">{item.description}</p>
                <p className="text-xs text-spa-text-secondary mt-1">
                  von <span className="font-medium text-spa-text-primary">{item.actor || 'System'}</span>
                </p>
              </div>
              <StatusBadge label={item.timestamp ? formatRelativeTime(item.timestamp) : 'Status'} tone={item.tone} showDot={false} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
