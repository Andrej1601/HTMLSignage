import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';

interface SystemChecksWidgetProps {
  backendStatus: 'ok' | 'error' | 'unknown';
  backendTone: StatusTone;
  dataTone: StatusTone;
  websocketTone: StatusTone;
  wsConnected: boolean;
  updateTone: StatusTone;
  isAdmin: boolean;
  updateLabel: string;
}

export function SystemChecksWidget({
  backendStatus,
  backendTone,
  dataTone,
  websocketTone,
  wsConnected,
  updateTone,
  isAdmin,
  updateLabel,
}: SystemChecksWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5" />
          System-Checks
        </h3>
        <Link
          to="/settings"
          className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
        >
          Zum System
        </Link>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">Backend API</span>
          <StatusBadge
            label={backendStatus === 'ok' ? 'OK' : 'Fehler'}
            tone={backendTone}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">Datenbasis</span>
          <StatusBadge
            label={dataTone === 'success' ? 'Konsistent' : 'Prüfen'}
            tone={dataTone}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-spa-text-secondary">WebSocket</span>
          <StatusBadge
            label={wsConnected ? 'Verbunden' : 'Getrennt'}
            tone={websocketTone}
            pulse={wsConnected}
          />
        </div>
        {isAdmin && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-spa-text-secondary">Systemupdate</span>
            <StatusBadge label={updateLabel} tone={updateTone} />
          </div>
        )}
      </div>
    </div>
  );
}
