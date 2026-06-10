import { useEffect, useMemo, useState } from 'react';
import { systemApi, type SystemJob } from '@/services/api';
import { Activity, RefreshCw } from 'lucide-react';
import { SystemJobCard } from './SystemJobCard';

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
            <SystemJobCard
              key={job.id}
              job={job}
              typeLabel={getJobLabel(job)}
              showError={false}
              showLog={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
