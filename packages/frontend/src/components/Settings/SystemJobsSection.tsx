import { useEffect, useMemo, useState } from 'react';
import { systemApi, type SystemJob } from '@/services/api';
import { Activity, Clock3, RefreshCw } from 'lucide-react';

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusClass(job: SystemJob): string {
  if (job.status === 'succeeded') return 'bg-spa-success-light text-spa-success-dark';
  if (job.status === 'failed') return 'bg-spa-error-light text-spa-error-dark';
  if (job.status === 'running') return 'bg-spa-primary/10 text-spa-primary';
  return 'bg-spa-warning-light text-spa-warning-dark';
}

function getJobLabel(job: SystemJob): string {
  if (job.type === 'system-update') return 'Systemupdate';
  return 'Backup-Import';
}

export function SystemJobsSection() {
  const [jobs, setJobs] = useState<SystemJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const hasRunningJobs = useMemo(
    () => jobs.some((job) => job.status === 'queued' || job.status === 'running'),
    [jobs],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await systemApi.listJobs(8);
        if (!cancelled) {
          setJobs(response.items);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    const interval = window.setInterval(load, hasRunningJobs ? 3000 : 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasRunningJobs]);

  return (
    <div className="rounded-lg border border-spa-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-base font-semibold text-spa-text-primary">
            <Activity className="h-4 w-4" />
            Systemjobs
          </h4>
          <p className="mt-1 text-sm text-spa-text-secondary">
            Laufende und letzte Hintergrundjobs für Update und Backup-Import.
          </p>
          <p className="mt-1 text-xs text-spa-text-secondary">
            Angezeigt werden nur die letzten 8 Einträge.
          </p>
        </div>
        {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-spa-text-secondary" />}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-spa-bg-secondary bg-spa-bg-primary px-4 py-6 text-sm text-spa-text-secondary">
          Noch keine Systemjobs vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(job)}`}>
                      {job.status === 'queued' ? 'Wartet' : job.status === 'running' ? 'Läuft' : job.status === 'succeeded' ? 'Erfolgreich' : 'Fehlgeschlagen'}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-spa-text-secondary border border-spa-bg-secondary">
                      {getJobLabel(job)}
                    </span>
                    <span className="text-sm font-semibold text-spa-text-primary">{job.title}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spa-text-secondary">
                    <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Erstellt: {formatDateTime(job.createdAt)}</span>
                    {job.finishedAt && <span>Fertig: {formatDateTime(job.finishedAt)}</span>}
                    {job.requestId && <span>Request-ID: {job.requestId}</span>}
                  </div>
                </div>

                {job.progress && (
                  <div className="min-w-[220px] rounded-lg border border-spa-bg-secondary bg-white px-3 py-2 text-xs text-spa-text-secondary">
                    <div className="font-semibold text-spa-text-primary">{job.progress.message}</div>
                    <div className="mt-1">Schritt: {job.progress.stage}</div>
                    {typeof job.progress.percent === 'number' && (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-spa-bg-secondary">
                        <div
                          className="h-full rounded-full bg-spa-primary transition-all"
                          style={{ width: `${Math.max(4, Math.min(100, job.progress.percent))}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
