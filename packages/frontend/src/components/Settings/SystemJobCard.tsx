import type { ReactNode } from 'react';
import axios from 'axios';
import { Clock3, ShieldAlert } from 'lucide-react';
import type { SystemJob, SystemJobStatus } from '@/services/api';
import { formatDateTimeDE } from '@/utils/dateUtils';
import { getVisibleJobLog } from './jobLog';

/** Builds a user-facing message from an axios/API error, appending the request id when present. */
export function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; error?: string; requestId?: string } | undefined;
    const msg = data?.message || data?.error;
    if (msg) {
      return data?.requestId ? `${msg} (Request-ID: ${data.requestId})` : msg;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const JOB_STATUS_LABEL: Record<SystemJobStatus, string> = {
  queued: 'Wartet',
  running: 'Läuft',
  succeeded: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
};

const JOB_STATUS_PILL: Record<SystemJobStatus, string> = {
  queued: 'bg-spa-warning-light text-spa-warning-dark',
  running: 'bg-spa-primary/10 text-spa-primary',
  succeeded: 'bg-spa-success-light text-spa-success-dark',
  failed: 'bg-spa-error-light text-spa-error-dark',
};

/** German label for a system job status. */
export function jobStatusLabel(status: SystemJobStatus): string {
  return JOB_STATUS_LABEL[status] ?? status;
}

interface SystemJobCardProps {
  job: SystemJob;
  /** Extra badge shown after the status pill (e.g. job-type label in the jobs list). */
  typeLabel?: string;
  /** Render the error banner when the job failed. Default true. */
  showError?: boolean;
  /** Render the job-log block. Default true. */
  showLog?: boolean;
  /** Extra content inserted between the header and the error/log blocks. */
  children?: ReactNode;
}

/**
 * Shared presentation of a single background `SystemJob`: status pill, title,
 * created/finished/request-id meta, live progress, and (optionally) an error
 * banner and the trailing job log. Used by the Update, Backup and Jobs sections.
 */
export function SystemJobCard({
  job,
  typeLabel,
  showError = true,
  showLog = true,
  children,
}: SystemJobCardProps) {
  const visibleLog = showLog ? getVisibleJobLog(job.log || '') : null;

  return (
    <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${JOB_STATUS_PILL[job.status]}`}>
              {jobStatusLabel(job.status)}
            </span>
            {typeLabel && (
              <span className="rounded-full border border-spa-bg-secondary bg-spa-surface px-2.5 py-1 text-xs font-semibold text-spa-text-secondary">
                {typeLabel}
              </span>
            )}
            <span className="text-sm font-semibold text-spa-text-primary">{job.title}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spa-text-secondary">
            <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Erstellt: {formatDateTimeDE(job.createdAt)}</span>
            {job.finishedAt && <span>Fertig: {formatDateTimeDE(job.finishedAt)}</span>}
            {job.requestId && <span>Request-ID: {job.requestId}</span>}
          </div>
        </div>

        {job.progress && (
          <div className="min-w-[220px] rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-xs text-spa-text-secondary">
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

      {children}

      {showError && job.error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-spa-error/30 bg-spa-error-light p-3 text-sm text-spa-error-dark">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            {job.error.message}
            {job.error.requestId ? ` (Request-ID: ${job.error.requestId})` : ''}
          </span>
        </div>
      )}

      {showLog && visibleLog?.text && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-spa-text-secondary">Job-Log</span>
            {visibleLog.truncated && (
              <span className="text-spa-text-secondary">
                Es werden nur die letzten 120 Logzeilen angezeigt.
              </span>
            )}
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#111827] p-3 text-xs text-[#e5e7eb]">
            {visibleLog.text}
          </pre>
        </div>
      )}
    </div>
  );
}
