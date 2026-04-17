import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { systemApi } from '@/services/api/system';
import type { AuditLogItem } from '@/services/api/types';

interface CrashRow {
  id: string;
  designId: string;
  slideType: string;
  message: string;
  deviceId: string | null;
  occurredAt: string;
}

const CRASH_ACTION = 'display.design.crash';

function projectCrash(item: AuditLogItem): CrashRow | null {
  const details = (item.details ?? {}) as Record<string, unknown>;
  const designId = typeof details.designId === 'string' ? details.designId : item.resource ?? '';
  const slideType = typeof details.slideType === 'string' ? details.slideType : '?';
  const message = typeof details.message === 'string' ? details.message : '';
  const occurredAt = typeof details.occurredAt === 'string' ? details.occurredAt : item.timestamp;
  const deviceId = typeof details.deviceId === 'string' ? details.deviceId : null;
  if (!designId || !message) return null;
  return { id: item.id, designId, slideType, message, deviceId, occurredAt };
}

function formatRelative(timestamp: string, now: Date): string {
  const t = new Date(timestamp).getTime();
  if (!Number.isFinite(t)) return '—';
  const diffMs = Math.max(0, now.getTime() - t);
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.round(diffH / 24);
  return `vor ${diffD} Tag${diffD === 1 ? '' : 'en'}`;
}

/**
 * Lists the most recent design renderer crashes captured by the
 * DesignErrorBoundary → telemetry pipeline. Sourced from the audit
 * log, filtered server-side on the `display.design.crash` action.
 */
export function DesignHealthCard() {
  const [items, setItems] = useState<CrashRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await systemApi.getAuditLog(20, null, { actions: [CRASH_ACTION] });
      const projected = response.items
        .map(projectCrash)
        .filter((row): row is CrashRow => row !== null);
      setItems(projected);
      setNow(new Date());
    } catch {
      setError('Audit-Log konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.designId, (map.get(item.designId) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-base font-semibold text-spa-text-primary">
          <Activity className="h-4 w-4" />
          Design-Health
        </h4>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-spa-bg-secondary px-2 py-1 text-xs text-spa-text-primary hover:bg-spa-bg-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>
      <p className="mb-3 text-sm text-spa-text-secondary">
        Letzte abgefangene Renderer-Crashes der aktiven Design-Packs. Jeder
        Eintrag entstand, weil ein Slide-Renderer geworfen hat — die Anzeige
        ist auf einen stillen Platzhalter zurückgefallen.
      </p>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-spa-error/20 bg-spa-error-light px-3 py-2 text-sm text-spa-error-dark">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg bg-spa-success-light px-3 py-2 text-sm text-spa-success-dark">
          Keine Renderer-Crashes erfasst.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {grouped.map(([designId, count]) => (
              <span
                key={designId}
                className="inline-flex items-center gap-1 rounded-full border border-spa-warning/30 bg-spa-warning-light px-2 py-0.5 text-spa-warning-dark"
              >
                <strong>{designId}</strong>
                <span>· {count}</span>
              </span>
            ))}
          </div>

          <ul className="divide-y divide-spa-bg-secondary text-sm">
            {items.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs uppercase tracking-wide text-spa-text-secondary">
                    {row.designId} · {row.slideType}
                  </span>
                  <span className="shrink-0 text-xs text-spa-text-secondary">
                    {formatRelative(row.occurredAt, now)}
                  </span>
                </div>
                <div className="text-spa-text-primary">{row.message}</div>
                {row.deviceId ? (
                  <div className="font-mono text-[11px] text-spa-text-secondary">
                    Device: {row.deviceId}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
