import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  systemApi,
  type GitHubRelease,
  type SystemReleasesResponse,
  type SystemUpdateRunResponse,
} from '@/services/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
} from 'lucide-react';

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { message?: string; error?: string } | undefined)?.message
      || (error.response?.data as { message?: string; error?: string } | undefined)?.error;
    if (msg) return msg;
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

interface UpdateSectionProps {
  onFeedback: (feedback: { type: 'success' | 'error' | 'warning'; message: string } | null) => void;
}

export function UpdateSection({ onFeedback }: UpdateSectionProps) {
  const { token } = useAuth();

  const [releases, setReleases] = useState<SystemReleasesResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRunningUpdate, setIsRunningUpdate] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [updateResult, setUpdateResult] = useState<SystemUpdateRunResponse | null>(null);
  const [showOlderReleases, setShowOlderReleases] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<GitHubRelease | null>(null);
  const [isDowngrade, setIsDowngrade] = useState(false);

  const canRunActions = useMemo(() => Boolean(token), [token]);

  const loadReleases = useCallback(async () => {
    if (!token) return;
    setIsCheckingStatus(true);
    onFeedback(null);
    try {
      const result = await systemApi.getReleases(token);
      setReleases(result);
    } catch (e) {
      onFeedback({ type: 'error', message: errorMessage(e, 'Releases konnten nicht geladen werden.') });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [token, onFeedback]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const handleUpdateRequest = (release: GitHubRelease, downgrade: boolean) => {
    setIsDowngrade(downgrade);
    setConfirmTarget(release);
  };

  const handleConfirmUpdate = async () => {
    if (!token || !confirmTarget) return;
    setConfirmTarget(null);
    setIsRunningUpdate(true);
    onFeedback(null);
    setUpdateLog('');
    setUpdateResult(null);
    try {
      const result: SystemUpdateRunResponse = await systemApi.runUpdate(token, confirmTarget.tag);
      setUpdateLog(result.log || '');
      setUpdateResult(result);
      if (result.rolledBack) {
        onFeedback({ type: 'warning', message: `Update auf ${result.targetVersion} fehlgeschlagen. Automatischer Rollback wurde durchgeführt.` });
      } else {
        onFeedback({ type: 'success', message: result.note || `Update auf ${result.targetVersion} erfolgreich.` });
      }
      await loadReleases();
    } catch (e) {
      const message = errorMessage(e, 'Systemupdate fehlgeschlagen.');
      onFeedback({ type: 'error', message });
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { log?: string; rolledBack?: boolean; backupPath?: string } | undefined;
        if (data?.log) setUpdateLog(data.log);
        if (data?.rolledBack) {
          onFeedback({ type: 'warning', message: `${message} — Automatischer Rollback wurde durchgeführt.` });
        }
      }
    } finally {
      setIsRunningUpdate(false);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h4 className="text-base font-semibold text-spa-text-primary flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Systemupdate
              </h4>
              <p className="text-sm text-spa-text-secondary mt-1">
                Versionsverwaltung über GitHub Releases.
              </p>
            </div>
            {releases?.currentVersion && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-spa-primary/10 text-spa-primary">
                <Tag className="w-3 h-3" />
                v{releases.currentVersion}
              </span>
            )}
          </div>
          <button
            onClick={() => void loadReleases()}
            disabled={!canRunActions || isCheckingStatus || isRunningUpdate}
            className="px-3 py-2 rounded-lg border border-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-primary disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            Prüfen
          </button>
        </div>

        {releases?.isDirty && (
          <div className="mt-3 rounded-lg border border-spa-warning/30 bg-spa-warning-light text-spa-warning-dark px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Lokale uncommittete Änderungen vorhanden. Update wird blockiert.
          </div>
        )}

        {releases?.hasUpdate && releases.latestRelease && (
          <div className="mt-4 rounded-lg border border-spa-secondary/30 bg-spa-secondary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-spa-secondary/15 text-spa-secondary-dark">
                    <ArrowUpCircle className="w-3 h-3" />
                    Update verfügbar
                  </span>
                </div>
                <h5 className="text-sm font-semibold text-spa-text-primary">
                  {releases.latestRelease.name}
                </h5>
                <div className="flex items-center gap-3 mt-1 text-xs text-spa-text-secondary">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {releases.latestRelease.tag}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(releases.latestRelease.publishedAt)}
                  </span>
                </div>
                {releases.latestRelease.body && (
                  <p className="mt-2 text-sm text-spa-text-secondary whitespace-pre-line leading-relaxed">
                    {releases.latestRelease.body}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleUpdateRequest(releases.latestRelease!, false)}
                disabled={!canRunActions || isRunningUpdate || releases.isDirty}
                className="px-4 py-2 rounded-lg bg-spa-primary text-white hover:bg-spa-primary-dark disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Aktualisieren
              </button>
            </div>
          </div>
        )}

        {releases && !releases.hasUpdate && (
          <div className="mt-4 rounded-lg bg-spa-bg-primary p-3 text-sm text-spa-text-secondary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-spa-secondary" />
            Sie verwenden die aktuelle Version (v{releases.currentVersion}).
          </div>
        )}

        {releases && releases.olderReleases?.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowOlderReleases(!showOlderReleases)}
              className="flex items-center gap-2 text-sm font-medium text-spa-text-secondary hover:text-spa-text-primary transition-colors"
            >
              {showOlderReleases ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Ältere Releases ({releases.olderReleases.length})
            </button>

            {showOlderReleases && (
              <div className="mt-2 space-y-2">
                {releases.olderReleases.map((release) => (
                  <div
                    key={release.tag}
                    className="rounded-lg bg-spa-bg-primary p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-spa-text-primary truncate">
                          {release.name}
                        </span>
                        <span className="text-xs text-spa-text-secondary shrink-0">
                          {release.tag}
                        </span>
                      </div>
                      <span className="text-xs text-spa-text-secondary flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatDate(release.publishedAt)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUpdateRequest(release, true)}
                      disabled={!canRunActions || isRunningUpdate || releases.isDirty}
                      className="px-3 py-1.5 rounded-lg border border-spa-bg-secondary text-xs font-medium text-spa-text-secondary hover:bg-spa-bg-secondary disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      Installieren
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isRunningUpdate && (
          <div className="mt-4 rounded-lg border border-spa-accent/30 bg-spa-accent/5 p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <RefreshCw className="w-5 h-5 animate-spin text-spa-accent" />
                <span className="absolute inset-0 animate-ping rounded-full bg-spa-accent/20" />
              </div>
              <div>
                <p className="text-sm font-medium text-spa-text-primary">Update wird ausgeführt...</p>
                <p className="text-xs text-spa-text-secondary mt-0.5">
                  DB-Backup, Dependencies, Migrationen und Build. Bitte nicht schließen.
                </p>
              </div>
            </div>
          </div>
        )}

        {updateResult?.backupPath && !isRunningUpdate && (
          <div className="mt-3 rounded-lg bg-spa-bg-primary p-3 text-sm flex items-center gap-2 text-spa-text-secondary">
            <Database className="w-4 h-4 text-spa-primary shrink-0" />
            DB-Backup erstellt: <code className="text-xs bg-spa-bg-secondary px-1.5 py-0.5 rounded">{updateResult.backupPath}</code>
          </div>
        )}

        {updateResult && !isRunningUpdate && !updateResult.rolledBack && (
          <div className="mt-3 rounded-lg border border-spa-primary/20 bg-spa-primary/5 p-3 text-sm flex items-center gap-2 text-spa-text-primary">
            <Info className="w-4 h-4 text-spa-primary shrink-0" />
            <span>Bitte Backend-/Frontend-Dienste neu starten, um die neue Version zu aktivieren.</span>
          </div>
        )}

        {updateLog && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-spa-text-secondary mb-2">Update-Log</div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-[#111827] text-[#e5e7eb] text-xs p-3 whitespace-pre-wrap">
              {updateLog}
            </pre>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title={isDowngrade ? 'Ältere Version installieren' : 'Update installieren'}
        message={
          isDowngrade
            ? `Möchten Sie auf ${confirmTarget?.tag} downgraden? Es wird automatisch ein Datenbank-Backup erstellt. Bei Problemen erfolgt ein automatischer Rollback. Achtung: Datenbankänderungen neuerer Versionen könnten inkompatibel sein.`
            : `Möchten Sie auf ${confirmTarget?.tag} aktualisieren? Es wird automatisch ein Datenbank-Backup erstellt. Dies kann einige Minuten dauern.`
        }
        confirmLabel={isDowngrade ? 'Downgrade starten' : 'Update starten'}
        variant={isDowngrade ? 'warning' : 'default'}
        onConfirm={() => void handleConfirmUpdate()}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}
