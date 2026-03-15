import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  systemApi,
  type GitHubRelease,
  type SystemJob,
  type SystemReleasesResponse,
  type SystemUpdateCheck,
  type SystemUpdateCheckStatus,
  type SystemUpdatePreflight,
  type SystemUpdateVerification,
} from '@/services/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getVisibleJobLog } from './jobLog';
import {
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Wrench,
  ChevronDown,
  ChevronRight,
  Tag,
  Calendar,
  Database,
  Info,
  CheckCircle2,
  Clock3,
  ShieldAlert,
} from 'lucide-react';

function errorMessage(error: unknown, fallback: string): string {
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

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '-';
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return '-';
  return value.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getJobTone(job: SystemJob | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (!job) return 'neutral';
  if (job.status === 'succeeded') return 'success';
  if (job.status === 'failed') return 'error';
  if (job.status === 'running') return 'info';
  return 'warning';
}

function getCheckTone(status: SystemUpdateCheckStatus): string {
  if (status === 'ok') return 'border-spa-success/20 bg-spa-success-light text-spa-success-dark';
  if (status === 'error') return 'border-spa-error/25 bg-spa-error-light text-spa-error-dark';
  return 'border-spa-warning/25 bg-spa-warning-light text-spa-warning-dark';
}

function isUpdateCheckStatus(value: unknown): value is SystemUpdateCheckStatus {
  return value === 'ok' || value === 'warning' || value === 'error';
}

function isUpdateCheck(value: unknown): value is SystemUpdateCheck {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SystemUpdateCheck>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.detail === 'string' &&
    isUpdateCheckStatus(candidate.status)
  );
}

function parseVerification(value: unknown): SystemUpdateVerification | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SystemUpdateVerification>;
  if (
    typeof candidate.ready !== 'boolean' ||
    !Array.isArray(candidate.checks) ||
    !candidate.checks.every(isUpdateCheck) ||
    !Array.isArray(candidate.manualActions) ||
    candidate.manualActions.some((action) => typeof action !== 'string')
  ) {
    return null;
  }

  return {
    ready: candidate.ready,
    checks: candidate.checks,
    manualActions: candidate.manualActions,
  };
}

function deriveDirtyFromPreflight(preflight: SystemUpdatePreflight | null): boolean {
  if (!preflight) return false;
  return preflight.checks.some((check) => check.id === 'working-tree' && check.status === 'error');
}

interface UpdateSectionProps {
  onFeedback: (feedback: { type: 'success' | 'error' | 'warning'; message: string } | null) => void;
}

export function UpdateSection({ onFeedback }: UpdateSectionProps) {
  const { token } = useAuth();

  const [releases, setReleases] = useState<SystemReleasesResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isStartingUpdate, setIsStartingUpdate] = useState(false);
  const [latestJob, setLatestJob] = useState<SystemJob | null>(null);
  const [showOlderReleases, setShowOlderReleases] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<GitHubRelease | null>(null);
  const [isDowngrade, setIsDowngrade] = useState(false);
  const notifiedTerminalJobRef = useRef<string | null>(null);

  const canRunActions = useMemo(() => Boolean(token), [token]);
  const preflight = releases?.preflight || null;
  const isRunningUpdate = latestJob?.status === 'queued' || latestJob?.status === 'running';
  const isUpdateBlocked = !preflight?.ready;
  const updateResult = latestJob?.result && typeof latestJob.result === 'object' ? latestJob.result : null;
  const updateBackupPath = typeof updateResult?.backupPath === 'string' ? updateResult.backupPath : null;
  const updateNote = typeof updateResult?.note === 'string' ? updateResult.note : null;
  const updateRolledBack = Boolean(updateResult && 'rolledBack' in updateResult && updateResult.rolledBack);
  const updateVerification = useMemo(
    () => parseVerification(updateResult?.verification),
    [updateResult],
  );
  const effectiveIsDirty = releases?.isDirty || deriveDirtyFromPreflight(preflight);
  const visibleJobLog = useMemo(
    () => getVisibleJobLog(latestJob?.log || ''),
    [latestJob?.log],
  );

  const loadReleases = useCallback(async () => {
    if (!token) return;
    setIsCheckingStatus(true);
    try {
      const result = await systemApi.getReleases(token);
      setReleases(result);
      if (result.activeJob && result.activeJob.type === 'system-update') {
        setLatestJob(result.activeJob);
      }
    } catch (error) {
      onFeedback({ type: 'error', message: errorMessage(error, 'Releases konnten nicht geladen werden.') });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [token, onFeedback]);

  const loadLatestUpdateJob = useCallback(async () => {
    if (!token) return;
    try {
      const response = await systemApi.listJobs(token, 10);
      const updateJob = response.items.find((job) => job.type === 'system-update') || null;
      setLatestJob(updateJob);
    } catch {
      // Secondary status polling should not spam the UI.
    }
  }, [token]);

  useEffect(() => {
    void loadReleases();
    void loadLatestUpdateJob();
  }, [loadLatestUpdateJob, loadReleases]);

  useEffect(() => {
    if (!token || !latestJob || (latestJob.status !== 'queued' && latestJob.status !== 'running')) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await systemApi.getJob(token, latestJob.id);
        setLatestJob(response.job);
        if (response.job.status === 'succeeded' || response.job.status === 'failed') {
          void loadReleases();
        }
      } catch {
        // Polling errors are tolerated; the next interval retries.
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [latestJob, loadReleases, token]);

  useEffect(() => {
    if (!latestJob) return;
    if (latestJob.status !== 'succeeded' && latestJob.status !== 'failed') return;
    if (notifiedTerminalJobRef.current === latestJob.id) return;

    notifiedTerminalJobRef.current = latestJob.id;

    if (latestJob.status === 'succeeded') {
      onFeedback({
        type: updateRolledBack ? 'warning' : 'success',
        message: updateRolledBack
          ? 'Update wurde abgeschlossen, aber mit Rollback beendet.'
          : 'Update-Job wurde erfolgreich abgeschlossen.',
      });
    } else {
      onFeedback({
        type: 'error',
        message: latestJob.error?.requestId
          ? `${latestJob.error.message} (Request-ID: ${latestJob.error.requestId})`
          : (latestJob.error?.message || 'Update-Job fehlgeschlagen.'),
      });
    }
  }, [latestJob, onFeedback, updateRolledBack]);

  const handleUpdateRequest = (release: GitHubRelease, downgrade: boolean) => {
    setIsDowngrade(downgrade);
    setConfirmTarget(release);
  };

  const handleConfirmUpdate = async () => {
    if (!token || !confirmTarget) return;
    setConfirmTarget(null);
    setIsStartingUpdate(true);
    onFeedback(null);
    try {
      const response = await systemApi.runUpdate(token, confirmTarget.tag);
      setLatestJob(response.job);
      notifiedTerminalJobRef.current = null;
      onFeedback({ type: 'success', message: response.message });
      await loadReleases();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { job?: SystemJob; preflight?: SystemUpdatePreflight } | undefined;
        if (data?.job) {
          setLatestJob(data.job);
        }
        const nextPreflight = data?.preflight;
        if (nextPreflight) {
          setReleases((current) => current ? {
            ...current,
            preflight: nextPreflight,
            isDirty: deriveDirtyFromPreflight(nextPreflight),
          } : current);
        }
      }
      onFeedback({ type: 'error', message: errorMessage(error, 'Systemupdate konnte nicht gestartet werden.') });
      void loadReleases();
    } finally {
      setIsStartingUpdate(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-base font-semibold text-spa-text-primary">
                <Wrench className="h-4 w-4" />
                Systemupdate
              </h4>
              <p className="mt-1 text-sm text-spa-text-secondary">
                Versionsverwaltung über GitHub Releases, jetzt mit Hintergrundjob und Live-Status.
              </p>
            </div>
            {releases?.currentVersion && (
              <span className="inline-flex items-center gap-1 rounded-full bg-spa-primary/10 px-2.5 py-1 text-xs font-semibold text-spa-primary">
                <Tag className="h-3 w-3" />
                v{releases.currentVersion}
              </span>
            )}
          </div>
          <button
            onClick={() => void loadReleases()}
            disabled={!canRunActions || isCheckingStatus || isStartingUpdate}
            className="flex items-center gap-2 rounded-lg border border-spa-bg-secondary px-3 py-2 text-spa-text-secondary hover:bg-spa-bg-primary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            Prüfen
          </button>
        </div>

        {preflight && (
          <div className="mt-4 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h5 className="text-sm font-semibold text-spa-text-primary">Update-Preflight</h5>
                <p className="mt-1 text-sm text-spa-text-secondary">
                  Vor jedem Update werden Host, Git-Stand, Backup-Voraussetzungen und Build-Werkzeuge geprueft.
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-xs font-semibold ${
                preflight.ready
                  ? 'bg-spa-success-light text-spa-success-dark'
                  : 'bg-spa-error-light text-spa-error-dark'
              }`}>
                {preflight.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                {preflight.ready ? 'Update freigegeben' : 'Update blockiert'}
              </span>
            </div>

            {effectiveIsDirty && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-spa-warning/30 bg-spa-warning-light px-3 py-2 text-sm text-spa-warning-dark">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Lokale uncommittete Aenderungen vorhanden. Bitte zuerst committen oder bereinigen.
              </div>
            )}

            {!preflight.ready && preflight.blockers.length > 0 && (
              <div className="mt-3 rounded-lg border border-spa-error/25 bg-spa-error-light p-3 text-sm text-spa-error-dark">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Blocker vor dem Update
                </div>
                <ul className="mt-2 space-y-1 pl-5">
                  {preflight.blockers.map((blocker) => (
                    <li key={blocker} className="list-disc">
                      {blocker}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preflight.ready && preflight.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-spa-warning/30 bg-spa-warning-light p-3 text-sm text-spa-warning-dark">
                <div className="flex items-center gap-2 font-semibold">
                  <Info className="h-4 w-4 shrink-0" />
                  Hinweise vor dem Update
                </div>
                <ul className="mt-2 space-y-1 pl-5">
                  {preflight.warnings.map((warning) => (
                    <li key={warning} className="list-disc">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {preflight.checks.map((check) => (
                <div
                  key={check.id}
                  className={`rounded-lg border px-3 py-3 text-sm ${getCheckTone(check.status)}`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {check.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : check.status === 'error' ? (
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                    ) : (
                      <Info className="h-4 w-4 shrink-0" />
                    )}
                    {check.label}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed opacity-90">{check.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {releases?.hasUpdate && releases.latestRelease && (
          <div className="mt-4 rounded-lg border border-spa-secondary/30 bg-spa-secondary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-spa-secondary/15 px-2 py-0.5 text-xs font-semibold text-spa-secondary-dark">
                    <ArrowUpCircle className="h-3 w-3" />
                    Update verfügbar
                  </span>
                </div>
                <h5 className="text-sm font-semibold text-spa-text-primary">
                  {releases.latestRelease.name}
                </h5>
                <div className="mt-1 flex items-center gap-3 text-xs text-spa-text-secondary">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {releases.latestRelease.tag}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(releases.latestRelease.publishedAt)}
                  </span>
                </div>
                {releases.latestRelease.body && (
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-spa-text-secondary">
                    {releases.latestRelease.body}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleUpdateRequest(releases.latestRelease!, false)}
                disabled={!canRunActions || isStartingUpdate || isRunningUpdate || isUpdateBlocked}
                className="flex shrink-0 items-center gap-2 rounded-lg bg-spa-primary px-4 py-2 text-white hover:bg-spa-primary-dark disabled:opacity-50"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Aktualisieren
              </button>
            </div>
          </div>
        )}

        {releases && !releases.hasUpdate && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-spa-bg-primary p-3 text-sm text-spa-text-secondary">
            <CheckCircle2 className="h-4 w-4 text-spa-secondary" />
            Sie verwenden die aktuelle Version (v{releases.currentVersion}).
          </div>
        )}

        {releases && releases.olderReleases?.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowOlderReleases(!showOlderReleases)}
              className="flex items-center gap-2 text-sm font-medium text-spa-text-secondary transition-colors hover:text-spa-text-primary"
            >
              {showOlderReleases ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Ältere Releases ({releases.olderReleases.length})
            </button>

            {showOlderReleases && (
              <div className="mt-2 space-y-2">
                {releases.olderReleases.map((release) => (
                  <div
                    key={release.tag}
                    className="flex items-center justify-between gap-3 rounded-lg bg-spa-bg-primary p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-spa-text-primary">
                          {release.name}
                        </span>
                        <span className="shrink-0 text-xs text-spa-text-secondary">
                          {release.tag}
                        </span>
                      </div>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-spa-text-secondary">
                        <Calendar className="h-3 w-3" />
                        {formatDate(release.publishedAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUpdateRequest(release, true)}
                      disabled={!canRunActions || isStartingUpdate || isRunningUpdate || isUpdateBlocked}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-spa-bg-secondary px-3 py-1.5 text-xs font-medium text-spa-text-secondary hover:bg-spa-bg-secondary disabled:opacity-50"
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5" />
                      Installieren
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {latestJob && (
          <div className="mt-4 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    getJobTone(latestJob) === 'success'
                      ? 'bg-spa-success-light text-spa-success-dark'
                      : getJobTone(latestJob) === 'error'
                        ? 'bg-spa-error-light text-spa-error-dark'
                        : getJobTone(latestJob) === 'info'
                          ? 'bg-spa-primary/10 text-spa-primary'
                          : getJobTone(latestJob) === 'warning'
                            ? 'bg-spa-warning-light text-spa-warning-dark'
                            : 'bg-spa-bg-secondary text-spa-text-secondary'
                  }`}>
                    {latestJob.status === 'queued' ? 'Wartet' : latestJob.status === 'running' ? 'Läuft' : latestJob.status === 'succeeded' ? 'Erfolgreich' : 'Fehlgeschlagen'}
                  </span>
                  <span className="text-sm font-semibold text-spa-text-primary">{latestJob.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spa-text-secondary">
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Erstellt: {formatDateTime(latestJob.createdAt)}</span>
                  {latestJob.finishedAt && <span>Fertig: {formatDateTime(latestJob.finishedAt)}</span>}
                  {latestJob.requestId && <span>Request-ID: {latestJob.requestId}</span>}
                </div>
              </div>

              {latestJob.progress && (
                <div className="min-w-[220px] rounded-lg bg-white px-3 py-2 text-xs text-spa-text-secondary border border-spa-bg-secondary">
                  <div className="font-semibold text-spa-text-primary">{latestJob.progress.message}</div>
                  <div className="mt-1">Schritt: {latestJob.progress.stage}</div>
                  {typeof latestJob.progress.percent === 'number' && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-spa-bg-secondary">
                      <div
                        className="h-full rounded-full bg-spa-primary transition-all"
                        style={{ width: `${Math.max(4, Math.min(100, latestJob.progress.percent))}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {updateBackupPath && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-white p-3 text-sm text-spa-text-secondary border border-spa-bg-secondary">
                <Database className="h-4 w-4 shrink-0 text-spa-primary" />
                DB-Backup erstellt: <code className="rounded bg-spa-bg-secondary px-1.5 py-0.5 text-xs">{updateBackupPath}</code>
              </div>
            )}

            {updateNote && latestJob.status === 'succeeded' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-spa-primary/20 bg-spa-primary/5 p-3 text-sm text-spa-text-primary">
                <Info className="h-4 w-4 shrink-0 text-spa-primary" />
                <span>{updateNote}</span>
              </div>
            )}

            {updateVerification && (
              <div className="mt-3 rounded-lg border border-spa-bg-secondary bg-white p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h5 className="text-sm font-semibold text-spa-text-primary">
                      Post-Update-Verifikation
                    </h5>
                    <p className="mt-1 text-xs text-spa-text-secondary">
                      Build-Artefakte und Zielstand wurden nach dem Update erneut geprueft.
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-xs font-semibold ${
                    updateVerification.ready
                      ? 'bg-spa-success-light text-spa-success-dark'
                      : 'bg-spa-error-light text-spa-error-dark'
                  }`}>
                    {updateVerification.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    {updateVerification.ready ? 'Verifikation ok' : 'Verifikation fehlgeschlagen'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {updateVerification.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`rounded-lg border px-3 py-3 text-sm ${getCheckTone(check.status)}`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {check.status === 'ok' ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : check.status === 'error' ? (
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                        ) : (
                          <Info className="h-4 w-4 shrink-0" />
                        )}
                        {check.label}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed opacity-90">{check.detail}</p>
                    </div>
                  ))}
                </div>

                {updateVerification.manualActions.length > 0 && (
                  <div className="mt-3 rounded-lg border border-spa-warning/30 bg-spa-warning-light p-3 text-sm text-spa-warning-dark">
                    <div className="flex items-center gap-2 font-semibold">
                      <Info className="h-4 w-4 shrink-0" />
                      Manuelle Naechste Schritte
                    </div>
                    <ul className="mt-2 space-y-1 pl-5">
                      {updateVerification.manualActions.map((action) => (
                        <li key={action} className="list-disc">
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {latestJob.error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-spa-error/30 bg-spa-error-light p-3 text-sm text-spa-error-dark">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  {latestJob.error.message}
                  {latestJob.error.requestId ? ` (Request-ID: ${latestJob.error.requestId})` : ''}
                </span>
              </div>
            )}

            {visibleJobLog.text && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-spa-text-secondary">Job-Log</span>
                  {visibleJobLog.truncated && (
                    <span className="text-spa-text-secondary">
                      Es werden nur die letzten 120 Logzeilen angezeigt.
                    </span>
                  )}
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#111827] p-3 text-xs text-[#e5e7eb]">
                  {visibleJobLog.text}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={isDowngrade ? 'Ältere Version installieren' : 'Update installieren'}
        message={
          isDowngrade
            ? `Möchten Sie auf ${confirmTarget?.tag} downgraden? Es wird automatisch ein Datenbank-Backup erstellt. Der eigentliche Vorgang läuft anschließend als Hintergrundjob.`
            : `Möchten Sie auf ${confirmTarget?.tag} aktualisieren? Es wird automatisch ein Datenbank-Backup erstellt und das Update dann als Hintergrundjob ausgeführt.`
        }
        confirmLabel={isDowngrade ? 'Downgrade starten' : 'Update starten'}
        variant={isDowngrade ? 'warning' : 'default'}
        onConfirm={() => void handleConfirmUpdate()}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
