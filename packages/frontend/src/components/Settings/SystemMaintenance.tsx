import { useCallback, useState } from 'react';
import { UpdateSection } from './UpdateSection';
import { BackupSection } from './BackupSection';
import { SystemJobsSection } from './SystemJobsSection';
import { AlertTriangle, CheckCircle2, Cog, HardDrive, RefreshCw, XCircle } from 'lucide-react';

export function SystemMaintenance() {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  const handleFeedback = useCallback((fb: { type: 'success' | 'error' | 'warning'; message: string } | null) => {
    setFeedback(fb);
  }, []);

  const handleImportWarnings = useCallback((warnings: string[]) => {
    setImportWarnings(warnings);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
          <Cog className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-spa-text-primary">System</h3>
          <p className="text-sm text-spa-text-secondary">
            Systemkonfiguration, Updates und Wartung des Signage Hubs.
          </p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${
          feedback.type === 'success'
            ? 'border-spa-success-light bg-spa-success-light text-spa-success-dark'
            : feedback.type === 'warning'
            ? 'border-spa-warning-light bg-spa-warning-light text-spa-warning-dark'
            : 'border-spa-error-light bg-spa-error-light text-spa-error-dark'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-spa-success" />
          ) : feedback.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-spa-warning" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-spa-error" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Import warnings */}
      {importWarnings.length > 0 && (
        <div className="rounded-xl border border-spa-warning-light bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
          <div className="flex items-center gap-2 font-semibold mb-1.5">
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

      {/* 2-col section grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Update */}
        <section className="bg-spa-surface rounded-xl border border-spa-border shadow-xs hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-spa-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-spa-text-primary">Update-Verwaltung</h3>
          </div>
          <div className="p-5">
            <UpdateSection onFeedback={handleFeedback} />
          </div>
        </section>

        {/* Backup */}
        <section className="bg-spa-surface rounded-xl border border-spa-border shadow-xs hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-spa-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-spa-text-primary">Backup & Restore</h3>
          </div>
          <div className="p-5">
            <BackupSection onFeedback={handleFeedback} onImportWarnings={handleImportWarnings} />
          </div>
        </section>

        {/* System Jobs — full width */}
        <section className="lg:col-span-2 bg-spa-surface rounded-xl border border-spa-border shadow-xs hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-spa-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-spa-primary/10 flex items-center justify-center text-spa-primary">
              <Cog className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-spa-text-primary">Systemaufgaben</h3>
          </div>
          <div className="p-5">
            <SystemJobsSection />
          </div>
        </section>
      </div>
    </div>
  );
}
