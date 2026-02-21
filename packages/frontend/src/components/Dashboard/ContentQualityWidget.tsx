import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';

interface ContentQualityWidgetProps {
  livePresetLabel: string;
  autoPlay: boolean;
  activeEventName: string | null;
  planQuality: {
    totalRows: number;
    emptyRows: number;
    inconsistentRows: number;
    duplicateTimeRows: number;
  };
}

export function ContentQualityWidget({
  livePresetLabel,
  autoPlay,
  activeEventName,
  planQuality,
}: ContentQualityWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Inhalte & Planqualität
        </h3>
        <Link
          to="/schedule"
          className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
        >
          Zum Aufgussplan
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-spa-bg-secondary p-4">
          <p className="text-sm font-semibold text-spa-text-primary mb-2">Live-Inhalt</p>
          <div className="space-y-2 text-sm text-spa-text-secondary">
            <div className="flex items-center justify-between">
              <span>Aktives Preset</span>
              <span className="font-semibold text-spa-text-primary">{livePresetLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Modus</span>
              <StatusBadge
                label={autoPlay ? 'Auto-Play' : 'Manuell'}
                tone={autoPlay ? 'success' : 'warning'}
                showDot={false}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Event</span>
              <StatusBadge
                label={activeEventName || 'Kein aktives Event'}
                tone={activeEventName ? 'info' : 'neutral'}
                showDot={false}
              />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-spa-bg-secondary p-4">
          <p className="text-sm font-semibold text-spa-text-primary mb-2">Plan-Checks</p>
          <div className="space-y-2 text-sm text-spa-text-secondary">
            <div className="flex items-center justify-between">
              <span>Zeilen gesamt</span>
              <span className="font-semibold text-spa-text-primary">{planQuality.totalRows}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Leere Zeilen</span>
              <StatusBadge
                label={String(planQuality.emptyRows)}
                tone={planQuality.emptyRows > 0 ? 'warning' : 'success'}
                showDot={false}
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Konflikte</span>
              <StatusBadge
                label={String(planQuality.inconsistentRows + planQuality.duplicateTimeRows)}
                tone={(planQuality.inconsistentRows + planQuality.duplicateTimeRows) > 0 ? 'danger' : 'success'}
                showDot={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
