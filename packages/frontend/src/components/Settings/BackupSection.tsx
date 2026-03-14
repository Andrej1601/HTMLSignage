import { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { systemApi } from '@/services/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Download,
  Upload,
  RefreshCw,
  Calendar,
  FileArchive,
  HardDrive,
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

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `htmlsignage-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.zip`;
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

interface BackupSectionProps {
  onFeedback: (feedback: { type: 'success' | 'error' | 'warning'; message: string } | null) => void;
  onImportWarnings: (warnings: string[]) => void;
}

export function BackupSection({ onFeedback, onImportWarnings }: BackupSectionProps) {
  const { token } = useAuth();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [replaceMedia, setReplaceMedia] = useState(true);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canRunActions = useMemo(() => Boolean(token), [token]);

  const handleExportBackup = async () => {
    if (!token) return;
    setIsExporting(true);
    onFeedback(null);
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
      onFeedback({ type: 'success', message: 'Backup wurde erfolgreich heruntergeladen.' });
    } catch (e) {
      onFeedback({ type: 'error', message: errorMessage(e, 'Backup-Export fehlgeschlagen.') });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    setBackupFile(file);
    onImportWarnings([]);
  };

  const handleImportRequest = () => {
    if (!backupFile) return;
    setShowImportConfirm(true);
  };

  const handleConfirmImport = async () => {
    if (!token || !backupFile) return;
    setShowImportConfirm(false);
    setIsImporting(true);
    onFeedback(null);
    onImportWarnings([]);
    try {
      const result = await systemApi.importBackup(token, backupFile, replaceMedia);
      const parts = [`Backup importiert: ${result.importedMedia} Medien`];
      if (result.importedScheduleVersion) parts.push(`Aufgussplan v${result.importedScheduleVersion}`);
      if (result.importedSettingsVersion) parts.push(`Einstellungen v${result.importedSettingsVersion}`);
      onFeedback({ type: 'success', message: parts.join(', ') + '.' });
      if (result.warnings?.length) onImportWarnings(result.warnings);
      setBackupFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      onFeedback({ type: 'error', message: errorMessage(e, 'Backup-Import fehlgeschlagen.') });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.zip') || file.type === 'application/zip')) {
      handleFileSelect(file);
    }
  };

  const lastExportDate = localStorage.getItem('lastBackupExport');

  return (
    <>
      <div className="rounded-lg border border-spa-bg-secondary p-5">
        <h4 className="text-base font-semibold text-spa-text-primary mb-1 flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          Backup & Wiederherstellung
        </h4>
        <p className="text-sm text-spa-text-secondary mb-4">
          Aufgussplan, Einstellungen, Slideshow-Konfiguration und Medien sichern oder wiederherstellen.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export */}
          <div className="rounded-lg bg-spa-bg-primary p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Download className="w-4 h-4 text-spa-secondary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Export</h5>
            </div>
            <p className="text-xs text-spa-text-secondary mb-3 flex-1">
              Erstellt eine vollständige Sicherung aller Daten als ZIP-Backup mit Manifest und Medien-Dateien.
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

          {/* Import */}
          <div className="rounded-lg bg-spa-bg-primary p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-spa-primary" />
              <h5 className="text-sm font-semibold text-spa-text-primary">Import</h5>
            </div>

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
                accept=".zip,application/zip"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
              {backupFile ? (
                <>
                  <FileArchive className="w-5 h-5 text-spa-secondary" />
                  <span className="text-xs font-medium text-spa-text-primary">{backupFile.name}</span>
                  <span className="text-xs text-spa-text-secondary">{formatFileSize(backupFile.size)}</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-spa-text-secondary" />
                  <span className="text-xs text-spa-text-secondary">
                    ZIP-Backup hierher ziehen oder klicken
                  </span>
                </>
              )}
            </div>

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

      <ConfirmDialog
        isOpen={showImportConfirm}
        title="Backup importieren"
        message={`Möchten Sie "${backupFile?.name || 'Backup'}" importieren? ${replaceMedia ? 'Bestehende Medien werden ersetzt.' : 'Bestehende Medien bleiben erhalten.'} Aufgussplan und Einstellungen werden auf die importierte Version aktualisiert.`}
        confirmLabel="Importieren"
        variant="warning"
        onConfirm={() => void handleConfirmImport()}
        onCancel={() => setShowImportConfirm(false)}
      />
    </>
  );
}
