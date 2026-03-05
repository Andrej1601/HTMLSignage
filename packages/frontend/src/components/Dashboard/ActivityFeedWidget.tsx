import { useState, useMemo } from 'react';
import { CalendarDays, Image, Monitor, Settings, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import { formatRelativeTime } from '@/utils/dateUtils';

export type ActivityCategory = 'plan' | 'media' | 'device' | 'system';

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  tone: StatusTone;
  timestamp?: Date;
  actor?: string;
  category: ActivityCategory;
  details?: string[];
}

interface ActivityFeedWidgetProps {
  items: ActivityItem[];
}

type FilterKey = 'all' | ActivityCategory;

const CATEGORY_PILLS: { key: FilterKey; label: string; icon?: LucideIcon }[] = [
  { key: 'all', label: 'Alles' },
  { key: 'plan', label: 'Pläne', icon: CalendarDays },
  { key: 'media', label: 'Medien', icon: Image },
  { key: 'device', label: 'Geräte', icon: Monitor },
  { key: 'system', label: 'System', icon: Settings },
];

export function ActivityFeedWidget({ items }: ActivityFeedWidgetProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(
    () => activeFilter === 'all' ? items : items.filter((item) => item.category === activeFilter),
    [items, activeFilter],
  );

  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <h3 className="text-lg font-semibold text-spa-text-primary mb-4">
        Letzte Aktivitäten
      </h3>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CATEGORY_PILLS.map(({ key, label, icon: Icon }) => {
          const count = categoryCounts[key] || 0;
          if (key !== 'all' && count === 0) return null;
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-spa-accent text-white'
                  : 'bg-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary/80'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20' : 'bg-white/60'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Activity List */}
      <div className="space-y-2 max-h-[34rem] overflow-y-auto pr-1">
        {filteredItems.length === 0 && (
          <p className="text-sm text-spa-text-secondary">Keine Aktivität verfügbar.</p>
        )}
        {filteredItems.map((item) => {
          const isExpanded = expandedDetails.has(item.id);
          const hasDetails = item.details && item.details.length > 0;
          return (
            <div key={item.id} className="rounded-lg border border-spa-bg-secondary p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-spa-text-primary">{item.title}</p>
                  <p className="text-sm text-spa-text-secondary mt-0.5">{item.description}</p>
                  {item.actor && item.actor !== 'System' && item.actor !== 'Unbekannt' && (
                    <p className="text-xs text-spa-text-secondary mt-1">
                      von <span className="font-medium text-spa-text-primary">{item.actor}</span>
                    </p>
                  )}
                  {hasDetails && (
                    <button
                      onClick={() => toggleDetails(item.id)}
                      className="text-xs text-spa-accent hover:underline mt-1.5 flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          Details ausblenden
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3 h-3" />
                          {item.details!.length} {item.details!.length === 1 ? 'Änderung' : 'Änderungen'}
                        </>
                      )}
                    </button>
                  )}
                  {isExpanded && item.details && (
                    <ul className="mt-2 text-xs space-y-1 text-spa-text-secondary border-l-2 border-spa-bg-secondary pl-3">
                      {item.details.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {item.timestamp && (
                  <StatusBadge
                    label={formatRelativeTime(item.timestamp)}
                    tone={item.tone}
                    showDot={false}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
