import { useCallback, useState } from 'react';
import { UpdateSection } from './UpdateSection';
import { BackupSection } from './BackupSection';
import { SystemJobsSection } from './SystemJobsSection';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

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
      <div>
        <nav className="flex text-xs font-medium text-stone-400 uppercase tracking-widest mb-2 gap-1.5">
          <span>Admin</span>
          <span>/</span>
          <span>Einstellungen</span>
          <span>/</span>
          <span className="text-[#8B6F47]">System</span>
        </nav>
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">System</h2>
        <p className="text-stone-500 mt-1 text-sm">
          Systemkonfiguration, Updates und Wartung des HTMLSignage Hubs.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${
          feedback.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : feedback.type === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
          ) : feedback.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Import warnings */}
      {importWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-[#8B6F47] text-base">
              🔄
            </div>
            <h3 className="font-bold text-stone-800">Update-Verwaltung</h3>
          </div>
          <div className="p-5">
            <UpdateSection onFeedback={handleFeedback} />
          </div>
        </section>

        {/* Backup */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-[#8B6F47] text-base">
              💾
            </div>
            <h3 className="font-bold text-stone-800">Backup & Restore</h3>
          </div>
          <div className="p-5">
            <BackupSection onFeedback={handleFeedback} onImportWarnings={handleImportWarnings} />
          </div>
        </section>

        {/* System Jobs — full width */}
        <section className="lg:col-span-2 bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-[#8B6F47] text-base">
              ⚙️
            </div>
            <h3 className="font-bold text-stone-800">Systemaufgaben</h3>
          </div>
          <div className="p-5">
            <SystemJobsSection />
          </div>
        </section>
      </div>
    </div>
  );
}
