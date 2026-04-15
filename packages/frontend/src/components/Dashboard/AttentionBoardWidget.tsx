import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Image as ImageIcon,
  Monitor,
  Presentation,
  Settings2,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DashboardAttentionItem } from '@/hooks/useDashboardData';

interface AttentionBoardWidgetProps {
  items: DashboardAttentionItem[];
}

function getAreaIcon(area: DashboardAttentionItem['area']) {
  switch (area) {
    case 'devices':
      return Monitor;
    case 'schedule':
      return CalendarClock;
    case 'slideshow':
      return Presentation;
    case 'media':
      return ImageIcon;
    default:
      return Settings2;
  }
}

function getToneHeadline(count: number): string {
  if (count === 0) return 'Aktuell ist kein direkter Eingriff nötig.';
  if (count === 1) return 'Ein Punkt braucht gerade Aufmerksamkeit.';
  return `${count} Punkte brauchen gerade Aufmerksamkeit.`;
}

export function AttentionBoardWidget({ items }: AttentionBoardWidgetProps) {
  return (
    <section className="rounded-2xl border border-spa-bg-secondary bg-spa-surface p-6 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-spa-text-primary">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-spa-warning-light text-spa-warning-dark">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold">Handlungsbedarf</h3>
              <p className="mt-1 text-sm text-spa-text-secondary">
                {getToneHeadline(items.length)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            label={items.length > 0 ? `${items.length} offen` : 'Stabil'}
            tone={items.length > 0 ? items[0]?.tone || 'warning' : 'success'}
            showDot={false}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-spa-success/20 bg-spa-success-light/60 px-4 py-5 text-sm text-spa-success-dark">
          Geräte, Pläne und Systemstatus wirken aktuell stabil. Das Dashboard bleibt hier bewusst ruhig, solange nichts aus dem Tritt gerät.
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {items.map((item) => {
            const Icon = getAreaIcon(item.area);
            return (
              <Link
                key={item.id}
                to={item.href}
                className="group rounded-2xl border border-spa-bg-secondary bg-spa-bg-primary/60 p-4 transition-all hover:-translate-y-0.5 hover:border-spa-primary/20 hover:shadow-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-spa-surface text-spa-text-primary border border-spa-bg-secondary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <StatusBadge label={item.actionLabel} tone={item.tone} showDot={false} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-spa-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-spa-text-secondary">{item.detail}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-spa-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:text-spa-primary" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
