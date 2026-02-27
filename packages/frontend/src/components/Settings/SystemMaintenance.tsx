import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Download,
  Upload,
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
  FileJson,
  HardDrive,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

/* ── helpers ──────────────────────────────────────────────────────── */

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const msg = (error.response?.data as { message?: string; error?: string } | undefined)?.message
      || (error.response?.data as { message?: string; error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `htmlsignage-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── component ────────────────────────────────────────────────────── */

export function SystemMaintenance() {
  const { token } = useAuth();

  // Update state
  const [releases, setReleases] = useState<SystemReleasesResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRunningUpdate, setIsRunningUpdate] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [updateResult, setUpdateResult] = useState<SystemUpdateRunResponse | null>(null);
  const [showOlderReleases, setShowOlderReleases] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<GitHubRelease | null>(null);
  const [isDowngrade, setIsDowngrade] = useState(false);

  // Backup state
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [replaceMedia, setReplaceMedia] = useState(true);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  const canRunActions = useMemo(() => Boolean(token), [token]);

  /* ── Release / Update actions ───────────────────────────────────── */

  const loadReleases = useCallback(async () => {
    if (!token) return;
    setIsCheckingStatus(true);
    setFeedback(null);
    try {
      const result = await systemApi.getReleases(token);
      setReleases(result);
    } catch (e) {
      setFeedback({ type: 'error', message: errorMessage(e, 'Releases konnten nicht geladen werden.') });
    } finally {
      setIsCheckingStatus(false);
    }
  }, [token]);

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
    setFeedback(null);
    setUpdateLog('');
    setUpdateResult(null);
    try {
      const result: SystemUpdateRunResponse = await systemApi.runUpdate(token, confirmTarget.tag);
      setUpdateLog(result.log || '');
      setUpdateResult(result);
      if (result.rolledBack) {
        setFeedback({ type: 'warning', message: `Update auf ${result.targetVersion} fehlgeschlagen. Automatischer Rollback wurde durchgeführt.` });
      } else {
        setFeedback({ type: 'success', message: result.note || `Update auf ${result.targetVersion} erfolgreich.` });
      }
      await loadReleases();
    } catch (e) {
      const message = errorMessage(e, 'Systemupdate fehlgeschlagen.');
      setFeedback({ type: 'error', message });
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { log?: string; rolledBack?: boolean; backupPath?: string } | undefined;
        if (data?.log) setUpdateLog(data.log);
        if (data?.rolledBack) {
          setFeedback({ type: 'warning', message: `${message} — Automatischer Rollback wurde durchgeführt.` });
        }
      }
    } finally {
      setIsRunningUpdate(false);
    }
  };

  /* ── Backup actions ─────────────────────────────────────────────── */

  const handleExportBackup = async () => {
    if (!token) return;
    setIsExporting(true);
    setFeedback(null);
    try {
      const blob = await systemApi.exportBackup(token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFilename();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      localStorage.setItem('lastBackupExport', new Date().toISOString());
      setFeedback({ type: 'success', message: 'Backup wurde erfolgreich heruntergeladen.' });
    } catch (e) {
      setFeedback({ type: 'error', message: errorMessage(e, 'Backup-Export fehlgeschlagen.') });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setBackupFile(file);
    setImportWarnings([]);
  };

  const handleImportRequest = () => {
    if (!backupFile) return;
    setShowImportConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!token || !backupFile) return;
    setShowImportConfirm(false);
    setIsImporting(true);
    setFeedback(null);
    setImportWarnings([]);
    try {
      const result = await systemApi.importBackup(token, backupFile, replaceMedia);
      const parts = [`Backup importiert: ${result.importedMedia} Medien`];
      if (result.importedScheduleVersion) parts.push(`Aufgussplan v${result.importedScheduleVersion}`);
      if (result.importedSettingsVersion) parts.push(`Einstellungen v${result.importedSettingsVersion}`);
      setFeedback({ type: 'success', message: parts.join(', ') + '.' });
      if (result.warnings?.length) setImportWarnings(result.warnings);
      setBackupFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadReleases();
    } catch (e) {
      setFeedback({ type: 'error', message: errorMessage(e, 'Backup-Import fehlgeschlagen.') });
    } finally {
      setIsImporting(false);
    }
  };

  /* ── Drag & Drop ────────────────────────────────────────────────── */

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.json') || file.type === 'application/json')) {
      handleFileSelect(file);
    }
  };

  const lastExportDate = localStorage.getItem('lastBackupExport');

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ═══ Systemupdate ═══ */}
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

        {/* Dirty-Warnung */}
        {releases?.isDirty && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Lokale uncommittete Änderungen vorhanden. Update wird blockiert.
          </div>
        )}

        {/* Neuestes Release (Update verfügbar) */}
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

        {/* Kein Update */}
        {releases && !releases.hasUpdate && (
          <div className="mt-4 rounded-lg bg-spa-bg-primary p-3 text-sm text-spa-text-secondary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-spa-secondary" />
            Sie verwenden die aktuelle Version (v{releases.currentVersion}).
          </div>
        )}

        {/* Ältere Releases */}
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

        {/* Update läuft */}
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

        {/* DB-Backup Info nach Update */}
        {updateResult?.backupPath && !isRunningUpdate && (
          <div className="mt-3 rounded-lg bg-spa-bg-primary p-3 text-sm flex items-center gap-2 text-spa-text-secondary">
            <Database className="w-4 h-4 text-spa-primary shrink-0" />
            DB-Backup erstellt: <code className="text-xs bg-spa-bg-secondary px-1.5 py-0.5 rounded">{updateResult.backupPath}</code>
          </div>
        )}

        {/* Service-Neustart Hinweis nach Update */}
        {updateResult && !isRunningUpdate && !updateResult.rolledBack && (
          <div className="mt-3 rounded-lg border border-spa-primary/20 bg-spa-primary/5 p-3 text-sm flex items-center gap-2 text-spa-text-primary">
            <Info className="w-4 h-4 text-spa-primary shrink-0" />
            <span>Bitte Backend-/Frontend-Dienste neu starten, um die neue Version zu aktivieren.</span>
          </div>
        )}

        {/* Update-Log */}
        {updateLog && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-spa-text-secondary mb-2">Update-Log</div>
            <pre className="max-h-64 overflow-auto rounded-lg bg-[#111827] text-[#e5e7eb] text-xs p-3 whitespace-pre-wrap">
              {updateLog}
            </pre>
          </div>
        )}
      </div>

      {/* ═══ Backup ═══ */}
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <h4 className="text-base font-semibold text-spa-text-primary mb-1 flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          Backup & Wiederherstellung
        </h4>
        <p className="text-sm text-spa-text-secondary mb-4">
          Aufgussplan, Einstellungen, Slideshow-Konfiguration und Medien sichern oder wiederherstellen.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export-Karte */}
          <div className="rounded-lg bg-spa-bg-primary p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-spa-secondary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Export</h5>
            </div>
            <p className="text-xs text-spa-text-secondary mb-3 flex-1">
              Erstellt eine vollständige Sicherung aller Daten als JSON-Datei (inkl. Medien als Base64).
            </p>
            {lastExportDate && (
              <p className="text-xs text-spa-text-secondary mb-3 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Letzter Export: {formatDate(lastExportDate)}
              </p>
            )}
            <button
              onClick={() => void handleExportBackup()}
              disabled={!canRunActions || isExporting || isImporting}
              className="px-4 py-2 rounded-lg bg-spa-secondary text-white hover:bg-spa-secondary-dark disabled:opacity-50 flex items-center justify-center gap-2 w-full"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Exportiere...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Backup erstellen
                </>
              )}
            </button>
          </div>

          {/* Import-Karte */}
          <div className="rounded-lg bg-spa-bg-primary p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-spa-primary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Import</h5>
            </div>

            {/* Drop-Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative mb-3 flex-1 min-h-[80px] rounded-lg border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center gap-1 p-3 ${
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
                accept=".json,application/json"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
              {backupFile ? (
                <>
                  <FileJson className="w-5 h-5 text-spa-secondary" />
                  <span className="text-xs font-medium text-spa-text-primary">{backupFile.name}</span>
                  <span className="text-xs text-spa-text-secondary">{formatFileSize(backupFile.size)}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-spa-text-secondary" />
                  <span className="text-xs text-spa-text-secondary">
                    JSON-Datei hierher ziehen oder klicken
                  </span>
                </>
              )}
            </div>

            {/* Replace-Media Toggle */}
            <label className="mb-3 flex items-start gap-2 text-xs text-spa-text-secondary">
              <input
                type="checkbox"
                checked={replaceMedia}
                onChange={(e) => setReplaceMedia(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-spa-text-primary">Bestehende Medien ersetzen</span>
                <br />
                Deaktivieren, um vorhandene Medien beizubehalten und nur neue hinzuzufügen.
              </span>
            </label>

            <button
              onClick={handleImportRequest}
              disabled={!canRunActions || !backupFile || isImporting || isExporting}
              className="px-4 py-2 rounded-lg bg-spa-primary text-white hover:bg-spa-primary-dark disabled:opacity-50 flex items-center justify-center gap-2 w-full"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Import läuft...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Backup importieren
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Feedback ═══ */}
      {feedback && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
          feedback.type === 'success'
            ? 'border-spa-secondary/30 bg-spa-secondary/10 text-spa-secondary-dark'
            : feedback.type === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : feedback.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Import-Warnungen */}
      {importWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Hinweise zum Import
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs">
            {importWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Dialoge ═══ */}
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

      <ConfirmDialog
        isOpen={showImportConfirm}
        title="Backup importieren"
        message={`Möchten Sie "${backupFile?.name || 'Backup'}" importieren? ${replaceMedia ? 'Bestehende Medien werden ersetzt.' : 'Bestehende Medien bleiben erhalten.'} Aufgussplan und Einstellungen werden auf die importierte Version aktualisiert.`}
        confirmLabel="Importieren"
        variant="warning"
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => setShowImportConfirm(false)}
      />
    </div>
  );
}
