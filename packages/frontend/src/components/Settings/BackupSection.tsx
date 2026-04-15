import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  systemApi,
  type SystemBackupPreviewResponse,
  type SystemJob,
} from '@/services/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { getVisibleJobLog } from './jobLog';
import {
  Download,
  Upload,
  RefreshCw,
  Calendar,
  FileArchive,
  HardDrive,
  AlertTriangle,
  GitCompare,
  History,
  Package,
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

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `htmlsignage-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.zip`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getJobTone(job: SystemJob | null): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (!job) return 'neutral';
  if (job.status === 'succeeded') return 'success';
  if (job.status === 'failed') return 'error';
  if (job.status === 'running') return 'info';
  return 'warning';
}

interface BackupSectionProps {
  onFeedback: (feedback: { type: 'success' | 'error' | 'warning'; message: string } | null) => void;
  onImportWarnings: (warnings: string[]) => void;
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-spa-text-secondary">{label}</div>
      <div className="mt-1 text-sm font-semibold text-spa-text-primary">{value}</div>
    </div>
  );
}

export function BackupSection({ onFeedback, onImportWarnings }: BackupSectionProps) {
  const { user } = useAuth();

  const [isExporting, setIsExporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [replaceMedia, setReplaceMedia] = useState(true);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<SystemBackupPreviewResponse | null>(null);
  const [latestImportJob, setLatestImportJob] = useState<SystemJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifiedTerminalJobRef = useRef<string | null>(null);

  const canRunActions = Boolean(user);
  const lastExportDate = localStorage.getItem('lastBackupExport');
  const isImportRunning = latestImportJob?.status === 'queued' || latestImportJob?.status === 'running';
  const importResult = latestImportJob?.result && typeof latestImportJob.result === 'object' ? latestImportJob.result : null;
  const visibleImportLog = useMemo(
    () => getVisibleJobLog(latestImportJob?.log || ''),
    [latestImportJob?.log],
  );

  const resetPreview = () => {
    setPreview(null);
  };

  const loadLatestImportJob = useCallback(async () => {
    try {
      const response = await systemApi.listJobs(10);
      const job = response.items.find((item) => item.type === 'backup-import') || null;
      if (job) {
        setLatestImportJob(job);
      }
    } catch {
      // Silent background refresh.
    }
  }, []);

  useEffect(() => {
    void loadLatestImportJob();
  }, [loadLatestImportJob]);

  useEffect(() => {
    if (!latestImportJob || (latestImportJob.status !== 'queued' && latestImportJob.status !== 'running')) return;

    const interval = window.setInterval(async () => {
      try {
        const response = await systemApi.getJob(latestImportJob.id);
        setLatestImportJob(response.job);
      } catch {
        // Retry on next interval.
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [latestImportJob]);

  useEffect(() => {
    if (!latestImportJob) return;
    if (latestImportJob.status !== 'succeeded' && latestImportJob.status !== 'failed') return;
    if (notifiedTerminalJobRef.current === latestImportJob.id) return;

    notifiedTerminalJobRef.current = latestImportJob.id;

    if (latestImportJob.status === 'succeeded') {
      const warnings = Array.isArray(importResult?.warnings)
        ? importResult.warnings.filter((value): value is string => typeof value === 'string')
        : [];
      if (warnings.length > 0) {
        onImportWarnings(warnings);
      }
      onFeedback({ type: warnings.length > 0 ? 'warning' : 'success', message: 'Backup-Import wurde abgeschlossen.' });
      setBackupFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      onFeedback({
        type: 'error',
        message: latestImportJob.error?.requestId
          ? `${latestImportJob.error.message} (Request-ID: ${latestImportJob.error.requestId})`
          : (latestImportJob.error?.message || 'Backup-Import fehlgeschlagen.'),
      });
    }
  }, [importResult?.warnings, latestImportJob, onFeedback, onImportWarnings]);

  const handleExportBackup = async () => {
    setIsExporting(true);
    onFeedback(null);
    try {
      const blob = await systemApi.exportBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      localStorage.setItem('lastBackupExport', new Date().toISOString());
      onFeedback({ type: 'success', message: 'Backup wurde erfolgreich heruntergeladen.' });
    } catch (error) {
      onFeedback({ type: 'error', message: errorMessage(error, 'Backup-Export fehlgeschlagen.') });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setBackupFile(file);
    onImportWarnings([]);
    onFeedback(null);
    resetPreview();
  };

  const handlePreviewImport = async () => {
    if (!backupFile) return;
    setIsPreviewing(true);
    onFeedback(null);
    onImportWarnings([]);
    try {
      const result = await systemApi.previewBackupImport(backupFile, replaceMedia);
      setPreview(result);
      onFeedback({
        type: result.warnings.length > 0 ? 'warning' : 'success',
        message: result.warnings.length > 0
          ? 'Backup geprüft. Bitte Hinweise und Konflikte vor dem Import prüfen.'
          : 'Backup geprüft. Importvorschau ist bereit.',
      });
    } catch (error) {
      setPreview(null);
      onFeedback({ type: 'error', message: errorMessage(error, 'Backup-Vorschau fehlgeschlagen.') });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleImportRequest = () => {
    if (!backupFile) return;
    if (!preview) {
      void handlePreviewImport();
      return;
    }
    setShowImportConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!backupFile) return;
    setShowImportConfirm(false);
    setIsStartingImport(true);
    onFeedback(null);
    onImportWarnings([]);
    try {
      const response = await systemApi.importBackup(backupFile, replaceMedia);
      setLatestImportJob(response.job);
      notifiedTerminalJobRef.current = null;
      onFeedback({ type: 'success', message: response.message });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { job?: SystemJob } | undefined;
        if (data?.job) {
          setLatestImportJob(data.job);
        }
      }
      onFeedback({ type: 'error', message: errorMessage(error, 'Backup-Import konnte nicht gestartet werden.') });
    } finally {
      setIsStartingImport(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip')) {
      handleFileSelect(file);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <h4 className="mb-1 flex items-center gap-2 text-base font-semibold text-spa-text-primary">
          <HardDrive className="h-4 w-4" />
          Backup & Wiederherstellung
        </h4>
        <p className="mb-4 text-sm text-spa-text-secondary">
          Aufgussplan, Einstellungen, Slideshow-Konfiguration und Medien sichern oder kontrolliert wiederherstellen.
        </p>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex flex-col rounded-lg bg-spa-bg-primary p-4">
            <div className="mb-2 flex items-center gap-2">
              <Download className="h-4 w-4 text-spa-secondary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Export</h5>
            </div>
            <p className="mb-3 flex-1 text-xs text-spa-text-secondary">
              Erstellt eine vollständige Sicherung aller Daten als ZIP-Backup mit Manifest und Medien-Dateien.
            </p>
            {lastExportDate && (
              <p className="mb-3 flex items-center gap-1 text-xs text-spa-text-secondary">
                <Calendar className="h-3 w-3" />
                Letzter Export: {formatDate(lastExportDate)}
              </p>
            )}
            <button
              onClick={() => void handleExportBackup()}
              disabled={!canRunActions || isExporting || isPreviewing || isImportRunning || isStartingImport}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-spa-secondary px-4 py-2 text-white hover:bg-spa-secondary-dark disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Exportiere...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Backup erstellen
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col rounded-lg bg-spa-bg-primary p-4">
            <div className="mb-2 flex items-center gap-2">
              <Upload className="h-4 w-4 text-spa-primary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Import mit Dry-Run</h5>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative mb-3 flex min-h-[88px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 transition-colors ${
                isDragOver
                  ? 'border-spa-primary bg-spa-primary/5'
                  : backupFile
                    ? 'border-spa-secondary/40 bg-spa-secondary/5'
                    : 'border-spa-bg-secondary hover:border-spa-primary/40 hover:bg-spa-primary/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => handleFileSelect(event.target.files?.[0] || null)}
                className="hidden"
              />
              {backupFile ? (
                <>
                  <FileArchive className="h-5 w-5 text-spa-secondary" />
                  <span className="text-xs font-medium text-spa-text-primary">{backupFile.name}</span>
                  <span className="text-xs text-spa-text-secondary">{formatFileSize(backupFile.size)}</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-spa-text-secondary" />
                  <span className="text-xs text-spa-text-secondary">ZIP-Backup hierher ziehen oder klicken</span>
                </>
              )}
            </div>

            <label className="mb-3 flex items-start gap-2 text-xs text-spa-text-secondary">
              <input
                type="checkbox"
                checked={replaceMedia}
                onChange={(event) => {
                  setReplaceMedia(event.target.checked);
                  resetPreview();
                  onImportWarnings([]);
                }}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-spa-text-primary">Bestehende Medien ersetzen</span>
                <br />
                Deaktivieren, um vorhandene Medien zu behalten und nur neue hinzuzufügen.
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => void handlePreviewImport()}
                disabled={!canRunActions || !backupFile || isPreviewing || isImportRunning || isExporting || isStartingImport}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-spa-primary/20 px-4 py-2 text-spa-primary hover:bg-spa-primary/5 disabled:opacity-50"
              >
                {isPreviewing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Prüfe Backup...
                  </>
                ) : (
                  <>
                    <GitCompare className="h-4 w-4" />
                    Backup prüfen
                  </>
                )}
              </button>

              <button
                onClick={handleImportRequest}
                disabled={!canRunActions || !backupFile || isImportRunning || isExporting || isPreviewing || isStartingImport}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-spa-primary px-4 py-2 text-white hover:bg-spa-primary-dark disabled:opacity-50"
              >
                {isStartingImport ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Starte Import...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {preview ? 'Backup importieren' : 'Prüfen & importieren'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {latestImportJob && (
          <div className="mt-4 rounded-lg border border-spa-bg-secondary bg-spa-bg-primary p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    getJobTone(latestImportJob) === 'success'
                      ? 'bg-spa-success-light text-spa-success-dark'
                      : getJobTone(latestImportJob) === 'error'
                        ? 'bg-spa-error-light text-spa-error-dark'
                        : getJobTone(latestImportJob) === 'info'
                          ? 'bg-spa-primary/10 text-spa-primary'
                          : getJobTone(latestImportJob) === 'warning'
                            ? 'bg-spa-warning-light text-spa-warning-dark'
                            : 'bg-spa-bg-secondary text-spa-text-secondary'
                  }`}>
                    {latestImportJob.status === 'queued' ? 'Wartet' : latestImportJob.status === 'running' ? 'Läuft' : latestImportJob.status === 'succeeded' ? 'Erfolgreich' : 'Fehlgeschlagen'}
                  </span>
                  <span className="text-sm font-semibold text-spa-text-primary">{latestImportJob.title}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-spa-text-secondary">
                  <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Erstellt: {formatDate(latestImportJob.createdAt)}</span>
                  {latestImportJob.finishedAt && <span>Fertig: {formatDate(latestImportJob.finishedAt)}</span>}
                  {latestImportJob.requestId && <span>Request-ID: {latestImportJob.requestId}</span>}
                </div>
              </div>

              {latestImportJob.progress && (
                <div className="min-w-[220px] rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-xs text-spa-text-secondary">
                  <div className="font-semibold text-spa-text-primary">{latestImportJob.progress.message}</div>
                  <div className="mt-1">Schritt: {latestImportJob.progress.stage}</div>
                  {typeof latestImportJob.progress.percent === 'number' && (
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-spa-bg-secondary">
                      <div
                        className="h-full rounded-full bg-spa-primary transition-all"
                        style={{ width: `${Math.max(4, Math.min(100, latestImportJob.progress.percent))}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {latestImportJob.error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-spa-error/30 bg-spa-error-light p-3 text-sm text-spa-error-dark">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                  {latestImportJob.error.message}
                  {latestImportJob.error.requestId ? ` (Request-ID: ${latestImportJob.error.requestId})` : ''}
                </span>
              </div>
            )}

            {visibleImportLog.text && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-spa-text-secondary">Job-Log</span>
                  {visibleImportLog.truncated && (
                    <span className="text-spa-text-secondary">
                      Es werden nur die letzten 120 Logzeilen angezeigt.
                    </span>
                  )}
                </div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[#111827] p-3 text-xs text-[#e5e7eb]">
                  {visibleImportLog.text}
                </pre>
              </div>
            )}
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-4 rounded-lg border border-spa-primary/15 bg-spa-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-spa-text-primary">
              <History className="h-4 w-4" />
              Importvorschau
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-lg bg-spa-bg-primary p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Backup</div>
                <div className="grid grid-cols-2 gap-2">
                  <PreviewMetric label="Exportiert am" value={formatDate(preview.backup.exportedAt)} />
                  <PreviewMetric label="App-Version" value={preview.backup.appVersion || '-'} />
                  <PreviewMetric label="Medien" value={String(preview.backup.mediaCount)} />
                  <PreviewMetric label="Format" value={`v${preview.backup.formatVersion}`} />
                </div>
              </div>

              <div className="space-y-3 rounded-lg bg-spa-bg-primary p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Aktuelles System</div>
                <div className="grid grid-cols-2 gap-2">
                  <PreviewMetric label="App-Version" value={preview.current.appVersion} />
                  <PreviewMetric label="Medien" value={String(preview.current.mediaCount)} />
                  <PreviewMetric label="Plan-Version" value={preview.current.scheduleVersion ? `v${preview.current.scheduleVersion}` : '-'} />
                  <PreviewMetric label="Einstellungs-Version" value={preview.current.settingsVersion ? `v${preview.current.settingsVersion}` : '-'} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-spa-bg-secondary bg-spa-surface p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Importplan</div>
                <div className="grid grid-cols-2 gap-2">
                  <PreviewMetric label="Medienimport" value={String(preview.importPlan.importedMedia)} />
                  <PreviewMetric label="Modus" value={preview.importPlan.replaceMedia ? 'Ersetzen' : 'Zusammenführen'} />
                  <PreviewMetric label="Plan" value={preview.importPlan.scheduleWillReplace ? 'Wird ersetzt' : 'Unverändert'} />
                  <PreviewMetric label="Einstellungen" value={preview.importPlan.settingsWillReplace ? 'Werden ersetzt' : 'Unverändert'} />
                </div>
              </div>

              <div className="rounded-lg border border-spa-bg-secondary bg-spa-surface p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Konflikte & Hinweise</div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full border border-spa-bg-secondary bg-spa-bg-primary px-2.5 py-1 text-xs text-spa-text-secondary">
                    Umbenennungen: {preview.conflicts.filenameConflicts}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-spa-bg-secondary bg-spa-bg-primary px-2.5 py-1 text-xs text-spa-text-secondary">
                    ID-Konflikte: {preview.conflicts.mediaIdConflicts}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-spa-bg-secondary bg-spa-bg-primary px-2.5 py-1 text-xs text-spa-text-secondary">
                    Fehlende Benutzer: {preview.conflicts.missingUsers}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-spa-bg-secondary bg-spa-bg-primary px-2.5 py-1 text-xs text-spa-text-secondary">
                    Checksumme: {preview.backup.checksumValid ? 'OK' : 'Fehler'}
                  </span>
                </div>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Hinweise vor dem Import
                </div>
                <div className="space-y-1 text-xs">
                  {preview.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-spa-bg-secondary bg-spa-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-spa-text-secondary" />
                <div className="text-xs font-semibold uppercase tracking-wide text-spa-text-secondary">Medienvorschau</div>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1 overscroll-contain">
                {preview.previewMedia.map((item) => (
                  <div key={`${item.originalName}-${item.filename}`} className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-spa-text-primary">{item.originalName}</div>
                        <div className="truncate text-xs text-spa-text-secondary">
                          {item.filename} · {item.type} · {formatFileSize(item.size)}
                        </div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {item.willRename && (
                          <span className="inline-flex rounded-full bg-spa-warning-light px-2 py-0.5 text-[11px] text-spa-warning-dark">Umbenannt</span>
                        )}
                        {item.uploadedByMissing && (
                          <span className="inline-flex rounded-full bg-spa-error-light px-2 py-0.5 text-[11px] text-spa-error-dark">Benutzer fehlt</span>
                        )}
                      </div>
                    </div>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span key={`${item.filename}-${tag}`} className="inline-flex rounded-full border border-spa-bg-secondary bg-spa-surface px-2 py-0.5 text-[11px] text-spa-text-secondary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showImportConfirm}
        title="Backup importieren"
        message={preview
          ? `Möchten Sie "${backupFile?.name || 'Backup'}" importieren? ${preview.importPlan.importedMedia} Medien werden verarbeitet, Aufgussplan und Einstellungen werden ersetzt.${replaceMedia ? ' Bestehende Medien werden ersetzt.' : ' Bestehende Medien bleiben erhalten, Konflikte werden zusammengeführt.'} Der eigentliche Import läuft anschließend als Hintergrundjob.`
          : `Möchten Sie "${backupFile?.name || 'Backup'}" importieren?`
        }
        confirmLabel="Importieren"
        variant="warning"
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => setShowImportConfirm(false)}
      />
    </>
  );
}
