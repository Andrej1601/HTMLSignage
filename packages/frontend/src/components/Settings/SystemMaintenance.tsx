import { useCallback, useState } from 'react';
import { UpdateSection } from './UpdateSection';
import { BackupSection } from './BackupSection';
import { SystemJobsSection } from './SystemJobsSection';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

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
      <UpdateSection onFeedback={handleFeedback} />
      <BackupSection onFeedback={handleFeedback} onImportWarnings={handleImportWarnings} />
      <SystemJobsSection />

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
          feedback.type === 'success'
            ? 'border-spa-secondary/30 bg-spa-secondary/10 text-spa-secondary-dark'
            : feedback.type === 'warning'
            ? 'border-spa-warning/30 bg-spa-warning-light text-spa-warning-dark'
            : 'border-spa-error/30 bg-spa-error-light text-spa-error-dark'
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

      {/* Import warnings */}
      {importWarnings.length > 0 && (
        <div className="rounded-lg border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
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
    </div>
  );
}
