import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import {
  systemApi,
  type SystemUpdateRunResponse,
  type SystemUpdateStatusResponse,
} from '@/services/api';
import { Download, Upload, RefreshCw, ArrowUpCircle, AlertTriangle, Wrench } from 'lucide-react';

function shortCommit(value: string | null): string {
  if (!value) return '-';
  return value.slice(0, 8);
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string; error?: string } | undefined)?.message
      || (error.response?.data as { message?: string; error?: string } | undefined)?.error;
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `htmlsignage-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.json`;
}

export function SystemMaintenance() {
  const { token } = useAuth();
  const [status, setStatus] = useState<SystemUpdateStatusResponse | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isRunningUpdate, setIsRunningUpdate] = useState(false);
  const [updateLog, setUpdateLog] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [replaceMedia, setReplaceMedia] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRunActions = useMemo(() => Boolean(token), [token]);

  const loadStatus = async () => {
    if (!token) return;
    setIsCheckingStatus(true);
    setError(null);
    try {
      const result = await systemApi.getUpdateStatus(token);
      setStatus(result);
    } catch (e) {
      setError(errorMessage(e, 'Update-Status konnte nicht geladen werden.'));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRunUpdate = async () => {
    if (!token) return;
    if (!confirm('Systemupdate jetzt starten? Dies kann mehrere Minuten dauern.')) return;

    setIsRunningUpdate(true);
    setFeedback(null);
    setError(null);
    try {
      const result: SystemUpdateRunResponse = await systemApi.runUpdate(token);
      setUpdateLog(result.log || '');
      setFeedback(result.note || 'Systemupdate erfolgreich ausgefuehrt.');
      setStatus({
        ok: true,
        ...result.status,
        checkedAt: new Date().toISOString(),
      });
    } catch (e) {
      const message = errorMessage(e, 'Systemupdate fehlgeschlagen.');
      setError(message);
      if (axios.isAxiosError(e)) {
        const apiLog = (e.response?.data as { log?: string } | undefined)?.log;
        if (apiLog) {
          setUpdateLog(apiLog);
        }
      }
    } finally {
      setIsRunningUpdate(false);
    }
  };

  const handleExportBackup = async () => {
    if (!token) return;

    setIsExporting(true);
    setFeedback(null);
    setError(null);
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
      setFeedback('Backup wurde heruntergeladen.');
    } catch (e) {
      setError(errorMessage(e, 'Backup-Export fehlgeschlagen.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!token || !backupFile) return;
    if (!confirm('Backup importieren und aktuelle Daten ueberschreiben?')) return;

    setIsImporting(true);
    setFeedback(null);
    setError(null);
    try {
      const result = await systemApi.importBackup(token, backupFile, replaceMedia);
      setFeedback(`Backup importiert (${result.importedMedia} Medien).`);
      setBackupFile(null);
      const fileInput = document.getElementById('backup-import-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await loadStatus();
    } catch (e) {
      setError(errorMessage(e, 'Backup-Import fehlgeschlagen.'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-spa-text-primary flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Systemupdate
            </h4>
            <p className="text-sm text-spa-text-secondary mt-1">
              Prueft den Git-Stand und fuehrt Update inkl. Build aus.
            </p>
          </div>
          <button
            onClick={() => void loadStatus()}
            disabled={!canRunActions || isCheckingStatus || isRunningUpdate}
            className="px-3 py-2 rounded-md border border-spa-bg-secondary text-spa-text-secondary hover:bg-spa-bg-primary disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
            Status
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-spa-bg-primary p-3">
            <div className="text-xs text-spa-text-secondary">Branch</div>
            <div className="font-semibold text-spa-text-primary">{status?.branch || '-'}</div>
          </div>
          <div className="rounded-md bg-spa-bg-primary p-3">
            <div className="text-xs text-spa-text-secondary">Update verfuegbar</div>
            <div className="font-semibold text-spa-text-primary">
              {status?.hasUpdate ? 'Ja' : 'Nein'}
            </div>
          </div>
          <div className="rounded-md bg-spa-bg-primary p-3">
            <div className="text-xs text-spa-text-secondary">Lokaler Commit</div>
            <div className="font-mono text-spa-text-primary">{shortCommit(status?.currentCommit || null)}</div>
          </div>
          <div className="rounded-md bg-spa-bg-primary p-3">
            <div className="text-xs text-spa-text-secondary">Remote Commit</div>
            <div className="font-mono text-spa-text-primary">{shortCommit(status?.remoteCommit || null)}</div>
          </div>
        </div>

        {status?.isDirty && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Lokale uncommittete Aenderungen vorhanden. Update wird aus Sicherheitsgruenden blockiert.
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void handleRunUpdate()}
            disabled={!canRunActions || isRunningUpdate || Boolean(status?.isRunning)}
            className="px-4 py-2 rounded-md bg-spa-primary text-white hover:bg-spa-primary-dark disabled:opacity-50 flex items-center gap-2"
          >
            <ArrowUpCircle className="w-4 h-4" />
            {isRunningUpdate ? 'Update laeuft...' : 'Update ausfuehren'}
          </button>
          <span className="text-xs text-spa-text-secondary">
            Nach erfolgreichem Update ggf. Dienste neu starten.
          </span>
        </div>

        {updateLog && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-spa-text-secondary mb-2">Update-Log</div>
            <pre className="max-h-64 overflow-auto rounded-md bg-[#111827] text-[#e5e7eb] text-xs p-3 whitespace-pre-wrap">
              {updateLog}
            </pre>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <h4 className="text-base font-semibold text-spa-text-primary mb-1">Backup Import / Export</h4>
        <p className="text-sm text-spa-text-secondary mb-4">
          Enthalten sind Aufgussplan, Einstellungen (inkl. Saunen/Slideshow/Events) und Medien.
        </p>

        <div className="flex flex-wrap gap-3 items-center mb-4">
          <button
            onClick={() => void handleExportBackup()}
            disabled={!canRunActions || isExporting || isImporting}
            className="px-4 py-2 rounded-md border border-spa-secondary text-spa-secondary hover:bg-spa-secondary/10 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exportiere...' : 'Backup exportieren'}
          </button>
        </div>

        <div className="rounded-md bg-spa-bg-primary p-4">
          <label className="block text-sm font-medium text-spa-text-primary mb-2" htmlFor="backup-import-input">
            Backup-Datei importieren
          </label>
          <input
            id="backup-import-input"
            type="file"
            accept=".json,application/json"
            onChange={(event) => setBackupFile(event.target.files?.[0] || null)}
            className="block w-full text-sm text-spa-text-secondary file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-spa-secondary/15 file:text-spa-secondary"
          />

          <label className="mt-3 flex items-center gap-2 text-sm text-spa-text-secondary">
            <input
              type="checkbox"
              checked={replaceMedia}
              onChange={(event) => setReplaceMedia(event.target.checked)}
            />
            Bestehende Medien ersetzen
          </label>

          <div className="mt-3">
            <button
              onClick={() => void handleImportBackup()}
              disabled={!canRunActions || !backupFile || isImporting || isExporting}
              className="px-4 py-2 rounded-md bg-spa-primary text-white hover:bg-spa-primary-dark disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Import laeuft...' : 'Backup importieren'}
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-md border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">
          {feedback}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
