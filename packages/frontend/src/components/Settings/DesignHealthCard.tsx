import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { systemApi, type AuditLogItem } from '@/services/api';

interface DesignErrorDetails {
  designId?: unknown;
  slideType?: unknown;
  message?: unknown;
  url?: unknown;
  userAgent?: unknown;
}

interface DesignErrorRow {
  id: string;
  timestamp: string;
  designId: string;
  slideType: string;
  message: string;
  deviceResource: string | null;
  url: string | null;
}

const LOOKBACK_LIMIT = 30;
const AUTO_REFRESH_MS = 60_000;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toRow(item: AuditLogItem): DesignErrorRow | null {
  const details = (item.details || {}) as DesignErrorDetails;
  const designId = asString(details.designId);
  const slideType = asString(details.slideType);
  const message = asString(details.message);
  if (!designId || !slideType || !message) return null;

  return {
    id: item.id,
    timestamp: item.timestamp,
    designId,
    slideType,
    message,
    deviceResource: asString(item.resource),
    url: asString(details.url),
  };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Settings-tab card that surfaces recent design-pack renderer errors
 * captured by the `POST /api/telemetry/display/error` endpoint. Lets
 * operators spot crashes per pack without grepping the audit log.
 */
export function DesignHealthCard() {
  const [rows, setRows] = useState<DesignErrorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await systemApi.getAuditLog(LOOKBACK_LIMIT, null, [
        'design.pack.error',
      ]);
      const parsed = response.items
        .map(toRow)
        .filter((row): row is DesignErrorRow => row !== null);
      setRows(parsed);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Design-Pack-Fehler konnten nicht geladen werden.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Group by `designId` so operators see which pack is loudest.
  const grouped = new Map<string, DesignErrorRow[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.designId);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(row.designId, [row]);
    }
  }
  const groups = Array.from(grouped.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold text-spa-text-primary">
            {rows.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-spa-success" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-spa-warning" />
            )}
            Design-Pack-Gesundheit
          </h4>
          <p className="mt-1 text-xs text-spa-text-secondary">
            Letzte {LOOKBACK_LIMIT} Renderer-Fehler, die von Anzeigen gemeldet
            wurden. Automatische Aktualisierung alle 60 s.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Jetzt aktualisieren"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-spa-bg-secondary bg-spa-surface px-2.5 text-xs font-medium text-spa-text-secondary transition-colors hover:text-spa-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-md bg-spa-danger-light px-3 py-2 text-sm text-spa-danger-dark">
          {error}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-spa-bg-secondary px-3 py-6 text-sm text-spa-text-secondary">
          <CheckCircle2 className="h-4 w-4 text-spa-success" />
          <span>
            {loading
              ? 'Lade Gesundheitsstatus …'
              : 'Keine Pack-Fehler in den letzten Meldungen.'}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(([designId, designRows]) => (
            <details
              key={designId}
              className="group rounded-md border border-spa-bg-secondary bg-spa-bg-primary"
              open
            >
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm font-semibold text-spa-text-primary">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-spa-warning" />
                  {designId}
                </span>
                <span className="text-xs font-normal text-spa-text-secondary">
                  {designRows.length}{' '}
                  {designRows.length === 1 ? 'Meldung' : 'Meldungen'}
                </span>
              </summary>
              <ul className="divide-y divide-spa-bg-secondary">
                {designRows.slice(0, 10).map((row) => (
                  <li key={row.id} className="px-3 py-2 text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono font-semibold uppercase tracking-wide text-spa-text-secondary">
                        {row.slideType}
                      </span>
                      <span className="font-mono text-spa-text-secondary">
                        {formatTimestamp(row.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-spa-text-primary">{row.message}</p>
                    {row.deviceResource || row.url ? (
                      <p className="mt-1 text-spa-text-secondary">
                        {row.deviceResource ? `Gerät: ${row.deviceResource}` : null}
                        {row.deviceResource && row.url ? ' · ' : ''}
                        {row.url ? `URL: ${row.url}` : null}
                      </p>
                    ) : null}
                  </li>
                ))}
                {designRows.length > 10 ? (
                  <li className="px-3 py-2 text-xs text-spa-text-secondary">
                    + {designRows.length - 10} weitere (nur die neuesten 10
                    werden angezeigt)
                  </li>
                ) : null}
              </ul>
            </details>
          ))}
        </div>
      )}

      {lastRefreshedAt ? (
        <p className="mt-3 text-[11px] text-spa-text-secondary">
          Zuletzt aktualisiert:{' '}
          <time dateTime={lastRefreshedAt.toISOString()}>
            {lastRefreshedAt.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </time>
        </p>
      ) : null}
    </div>
  );
}
