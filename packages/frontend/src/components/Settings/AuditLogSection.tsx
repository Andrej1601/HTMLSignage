import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, User, Shield } from 'lucide-react';
import { systemApi, type AuditLogItem } from '@/services/api';
import { StatusBadge } from '@/components/StatusBadge';
import { formatAuditActionLabel, getAuditActionMeta, summarizeAuditDetails } from '@/utils/auditLog';

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogSection() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const loadAuditLog = useCallback(async (cursor?: string | null) => {
    const isLoadMore = Boolean(cursor);
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await systemApi.getAuditLog(50, cursor);
      setUnavailable(response.unavailable);
      setNextCursor(response.nextCursor);
      setItems((prev) => (isLoadMore ? [...prev, ...response.items] : response.items));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Audit-Log konnte nicht geladen werden.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadAuditLog(null);
  }, [loadAuditLog]);

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h4 className="text-base font-semibold text-spa-text-primary flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Audit-Log
          </h4>
          <p className="text-sm text-spa-text-secondary mt-1">
            Nachvollziehbarkeit für Änderungen, Importe und Systemaktionen.
          </p>
        </div>
        <button
          onClick={() => void loadAuditLog(null)}
          disabled={isLoading || isLoadingMore}
          className="px-3 py-2 rounded-lg border border-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-primary disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Neu laden
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-spa-error/30 bg-spa-error-light px-3 py-2 text-sm text-spa-error-dark mb-4">
          {error}
        </div>
      )}

      {unavailable && (
        <div className="rounded-lg border border-spa-warning/30 bg-spa-warning-light px-3 py-2 text-sm text-spa-warning-dark mb-4">
          Audit-Log ist aktuell nicht verfügbar. Die Tabelle wird beim ersten erfolgreichen Zugriff automatisch vorbereitet.
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto pr-1 overscroll-contain space-y-3">
        {items.map((item) => {
          const meta = getAuditActionMeta(item.action);
          const Icon = meta.icon;
          const detailLines = summarizeAuditDetails(item.details);

          return (
            <div key={item.id} className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge label={meta.group} tone={meta.tone} showDot={false} />
                    <p className="text-sm font-semibold text-spa-text-primary flex items-center gap-2 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{formatAuditActionLabel(item.action)}</span>
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spa-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {item.user?.username || 'System'}
                    </span>
                    <span>{formatDateTime(item.timestamp)}</span>
                    {item.resource && <span>Ressource: {item.resource}</span>}
                  </div>
                </div>
              </div>

              {detailLines.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {detailLines.map((line) => (
                    <span key={`${item.id}-${line}`} className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs text-spa-text-secondary border border-spa-bg-secondary">
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && items.length === 0 && (
          <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary px-3 py-6 text-sm text-spa-text-secondary text-center">
            Noch keine Audit-Einträge vorhanden.
          </div>
        )}
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => void loadAuditLog(nextCursor)}
            disabled={isLoadingMore || isLoading}
            className="px-4 py-2 rounded-lg bg-spa-secondary text-white hover:bg-spa-secondary-dark disabled:opacity-50"
          >
            {isLoadingMore ? 'Lädt...' : 'Weitere Einträge laden'}
          </button>
        </div>
      )}
    </div>
  );
}
