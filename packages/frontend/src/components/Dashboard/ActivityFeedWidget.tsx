import { Fragment, useState, useMemo } from 'react';
import { Shield, Settings2, Server, Monitor, Users, Image, ChevronDown, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StatusTone } from '@/components/StatusBadge';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';

export type ActivityCategory = 'einstellungen' | 'systemjobs' | 'device' | 'benutzer' | 'media';

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

const PAGE_SIZE = 10;

const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; colorClass: string; icon: LucideIcon }> = {
  einstellungen: { label: 'Einstellungen', colorClass: 'text-blue-600',   icon: Settings2 },
  systemjobs:    { label: 'Systemjobs',    colorClass: 'text-purple-600', icon: Server },
  device:        { label: 'Geräte',        colorClass: 'text-amber-600',  icon: Monitor },
  benutzer:      { label: 'Benutzer',      colorClass: 'text-rose-600',   icon: Users },
  media:         { label: 'Inhalte',       colorClass: 'text-teal-600',   icon: Image },
};

const STATUS_CONFIG: Record<StatusTone, { label: string; colorClass: string }> = {
  success: { label: 'Erfolg',   colorClass: 'text-emerald-600 font-semibold' },
  info:    { label: 'Info',     colorClass: 'text-blue-600 font-semibold' },
  warning: { label: 'Warnung',  colorClass: 'text-amber-600 font-semibold' },
  danger:  { label: 'Fehler',   colorClass: 'text-red-600 font-semibold' },
  neutral: { label: 'OK',       colorClass: 'text-stone-500 font-semibold' },
};

const CATEGORY_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',          label: 'Alle' },
  { key: 'einstellungen', label: 'Einstellungen' },
  { key: 'systemjobs',   label: 'Systemjobs' },
  { key: 'device',       label: 'Geräte' },
  { key: 'benutzer',     label: 'Benutzer' },
  { key: 'media',        label: 'Inhalte' },
];

function formatDateTime(date: Date): string {
  return date.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ActivityFeedWidget({ items }: ActivityFeedWidgetProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);
  const [page, setPage]                 = useState(0);

  const filteredItems = useMemo(
    () => activeFilter === 'all' ? items : items.filter((i) => i.category === activeFilter),
    [items, activeFilter],
  );

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageItems  = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx   = totalItems === 0 ? 0 : page * PAGE_SIZE + 1;
  const endIdx     = Math.min((page + 1) * PAGE_SIZE, totalItems);

  const handleFilter = (key: FilterKey) => {
    setActiveFilter(key);
    setPage(0);
    setExpandedRow(null);
  };

  const toggleRow = (id: string) => setExpandedRow((prev) => (prev === id ? null : id));

  const handleExport = () => {
    const header = 'Zeitstempel\tKategorie\tAktion\tBenutzer/System\tStatus\tDetails';
    const rows = items.map((item) => [
      item.timestamp ? formatDateTime(item.timestamp) : '-',
      CATEGORY_CONFIG[item.category]?.label ?? item.category,
      item.title,
      item.actor ?? 'System',
      STATUS_CONFIG[item.tone]?.label ?? item.tone,
      (item.details ?? []).join(' | '),
    ].join('\t'));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.tsv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardWidgetFrame
      title="Audit-Log"
      icon={Shield}
      actions={
        <button
          onClick={handleExport}
          className="text-sm font-medium text-spa-accent hover:underline whitespace-nowrap"
        >
          Alle exportieren
        </button>
      }
      contentClassName="p-0"
    >
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-1.5 px-6 pt-5 pb-4">
        {CATEGORY_PILLS.map(({ key, label }) => {
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => handleFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-spa-accent text-white'
                  : 'bg-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-secondary/80'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-spa-bg-secondary bg-spa-bg-primary/50">
              <th className="py-2.5 pl-6 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary whitespace-nowrap w-40">
                Zeitstempel
              </th>
              <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary w-36">
                Kategorie
              </th>
              <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary">
                Aktion
              </th>
              <th className="py-2.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary whitespace-nowrap w-36">
                Benutzer/System
              </th>
              <th className="py-2.5 pl-4 pr-6 text-left text-xs font-semibold uppercase tracking-wider text-spa-text-secondary w-24">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-spa-text-secondary">
                  Keine Einträge für diesen Filter.
                </td>
              </tr>
            )}
            {pageItems.map((item) => {
              const cat    = CATEGORY_CONFIG[item.category];
              const status = STATUS_CONFIG[item.tone];
              const isExpanded = expandedRow === item.id;
              const hasDetails = Boolean(item.description || (item.details && item.details.length > 0));

              return (
                <Fragment key={item.id}>
                  <tr
                    onClick={() => hasDetails && toggleRow(item.id)}
                    className={`border-b border-spa-bg-secondary/60 transition-colors ${
                      hasDetails ? 'cursor-pointer hover:bg-spa-bg-primary/50' : ''
                    } ${isExpanded ? 'bg-spa-bg-primary/40' : ''}`}
                  >
                    {/* Zeitstempel */}
                    <td className="py-3.5 pl-6 pr-4 font-mono text-xs text-spa-text-secondary whitespace-nowrap align-top">
                      {item.timestamp ? formatDateTime(item.timestamp) : '—'}
                    </td>

                    {/* Kategorie */}
                    <td className="py-3.5 px-4 align-top">
                      <span className={`text-xs font-bold tracking-wide uppercase ${cat?.colorClass ?? 'text-spa-text-secondary'}`}>
                        {cat?.label ?? item.category}
                      </span>
                    </td>

                    {/* Aktion */}
                    <td className="py-3.5 px-4 text-spa-text-primary align-top">
                      <div className="flex items-center gap-1.5">
                        {hasDetails && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-spa-text-secondary" />
                            : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-spa-text-secondary" />
                        )}
                        {item.title}
                      </div>
                    </td>

                    {/* Benutzer/System */}
                    <td className="py-3.5 px-4 font-semibold text-spa-text-primary whitespace-nowrap align-top">
                      {item.actor ?? 'System'}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 pl-4 pr-6 align-top">
                      <span className={`text-xs ${status?.colorClass ?? 'text-spa-text-secondary'}`}>
                        {status?.label ?? item.tone}
                      </span>
                    </td>
                  </tr>

                  {/* Detail-Zeile */}
                  {isExpanded && (
                    <tr className="border-b border-spa-bg-secondary/60 bg-spa-bg-primary/30">
                      <td colSpan={5} className="pl-14 pr-6 py-3">
                        <div className="flex flex-col gap-2">
                          {item.description && (
                            <p className="text-xs text-spa-text-secondary">{item.description}</p>
                          )}
                          {item.details && item.details.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.details.map((d, i) => (
                                <span
                                  key={i}
                                  className="inline-flex rounded-full bg-white border border-spa-bg-secondary px-2.5 py-1 text-xs text-spa-text-secondary"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: Pagination */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-spa-bg-secondary/60">
        <span className="text-xs text-spa-text-secondary">
          {totalItems === 0
            ? 'Keine Einträge'
            : `Zeige ${startIdx}–${endIdx} von ${totalItems} Einträgen`}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-medium border border-spa-bg-secondary rounded-lg text-spa-text-secondary hover:bg-spa-bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-spa-accent text-white hover:bg-spa-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Weiter
            </button>
          </div>
        </div>
      </div>
    </DashboardWidgetFrame>
  );
}
