import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Skeleton } from '@/components/Skeleton';
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid';
import { CellEditor } from '@/components/Schedule/CellEditor';
import { TimeEditor } from '@/components/Schedule/TimeEditor';
import {
  PRESET_LABELS,
} from '@/types/schedule.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner';
import { Save, Calendar } from 'lucide-react';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { useScheduleEditor } from '@/hooks/useScheduleEditor';
import { PresetTabs } from '@/components/Schedule/PresetTabs';
import { SaunaStatusInfo } from '@/components/Schedule/SaunaStatusInfo';
import { ScheduleActions } from '@/components/Schedule/ScheduleActions';

function SchedulePageSkeleton() {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
        <div className="rounded-xl border border-spa-bg-secondary bg-white p-6 space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} variant="rect" className="h-10 w-16 rounded-lg" />)}
          </div>
          <Skeleton variant="rect" className="h-64 w-full" />
        </div>
      </div>
    </Layout>
  );
}

function SchedulePageError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <Layout>
      <ErrorAlert error={error} onRetry={onRetry} />
    </Layout>
  );
}

export function SchedulePage() {
  const editor = useScheduleEditor();

  const paletteActions = useMemo(() => editor.isDirty ? [
    { id: 'schedule-save', label: 'Aufgussplan speichern', description: 'Ungespeicherte Änderungen sichern', icon: Save, group: 'Aktionen', action: editor.handleSave },
  ] : [], [editor.isDirty, editor.handleSave]);
  useCommandPaletteActions(paletteActions);

  if (editor.isLoading || !editor.localSchedule) {
    return <SchedulePageSkeleton />;
  }

  if (editor.error) {
    return <SchedulePageError error={editor.error} onRetry={() => editor.refetch()} />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Aufgussplan"
          description={`Version ${editor.localSchedule?.version || 1} · Live: ${PRESET_LABELS[editor.livePreset]} · Bearbeitung: ${PRESET_LABELS[editor.editingPreset]}`}
          icon={Calendar}
          actions={(
            <ScheduleActions editor={editor} />
          )}
          badges={[
            { label: `Live v${editor.schedule?.version || editor.localSchedule.version}`, tone: 'info' },
            editor.draftState.hasStoredDraft && !editor.isDirty
              ? { label: 'Lokaler Entwurf vorhanden', tone: 'warning' as const }
              : { label: 'Live-Stand', tone: 'neutral' as const },
            { label: editor.localSchedule.autoPlay ? 'Auto-Play' : 'Manuell', tone: editor.localSchedule.autoPlay ? 'success' as const : 'warning' as const },
            { label: editor.isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert', tone: editor.isDirty ? 'warning' as const : 'success' as const },
          ]}
        />

        {editor.draftState.hasStoredDraft && !editor.isDirty && (
          <DraftRecoveryBanner
            entityLabel="Aufgussplan"
            updatedAt={editor.draftState.draftUpdatedAt}
            onRestore={editor.handleRestoreDraft}
            onDiscard={editor.handleDiscardDraft}
          />
        )}

        {editor.isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-3 shadow-xs">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-semibold text-amber-800">Ungespeicherte Änderungen — oben auf Speichern klicken, um zu sichern.</span>
          </div>
        )}

        <EditorQualityAssistant
          description={`Direkte Plausibilitätschecks für ${PRESET_LABELS[editor.editingPreset]} und den aktuellen Redaktionsstand.`}
          issues={editor.scheduleQualityIssues}
          okMessage={`Für ${PRESET_LABELS[editor.editingPreset]} wurden aktuell keine strukturellen Planprobleme erkannt.`}
        />

        <PresetTabs editor={editor} />

        {editor.settings?.saunas && editor.settings.saunas.length > 0 && (
          <SaunaStatusInfo saunas={editor.settings.saunas} />
        )}

        {editor.currentDaySchedule && (
          <SectionCard title={`Tagesplan: ${PRESET_LABELS[editor.editingPreset]}`} noPadding>
            <ScheduleGrid
              daySchedule={editor.currentDaySchedule}
              aromas={editor.settings?.aromas || []}
              saunaColors={editor.saunaColors}
              onEditCell={editor.handleEditCell}
              onEditTime={editor.handleEditTime}
              onAddTimeRow={editor.handleAddTimeRow}
              onDeleteTimeRow={editor.handleDeleteTimeRow}
            />
          </SectionCard>
        )}

        <CellEditor
          entry={editor.editingCell?.entry || null}
          isOpen={editor.editingCell !== null}
          onClose={() => editor.setEditingCell(null)}
          onSave={editor.handleSaveCell}
          onDelete={editor.editingCell?.entry ? editor.handleDeleteCell : undefined}
          aromas={editor.settings?.aromas || []}
        />

        <TimeEditor
          time={editor.editingTime?.currentTime || null}
          isOpen={editor.editingTime !== null}
          onClose={() => editor.setEditingTime(null)}
          onSave={editor.handleSaveTime}
        />

        <ConfirmDialog
          isOpen={editor.unsavedGuard.isBlocked}
          title="Ungespeicherte Änderungen"
          message="Es gibt ungespeicherte Änderungen im Aufgussplan. Wirklich verlassen?"
          confirmLabel="Verlassen"
          cancelLabel="Bleiben"
          variant="warning"
          onConfirm={editor.unsavedGuard.proceed}
          onCancel={editor.unsavedGuard.reset}
        />

        <ConfirmDialog
          isOpen={Boolean(editor.pendingCopySource)}
          title="Tagesplan überschreiben?"
          message={(() => {
            if (!editor.pendingCopySource || !editor.localSchedule) return '';
            const source = editor.localSchedule.presets[editor.pendingCopySource];
            const target = editor.currentDaySchedule;
            const sourceRows = source?.rows?.length || 0;
            const targetRows = target?.rows?.length || 0;
            return `${PRESET_LABELS[editor.pendingCopySource]} (${sourceRows} Zeitslots) → ${PRESET_LABELS[editor.editingPreset]} (${targetRows} Zeitslots)\n\nDer aktuelle Plan für ${PRESET_LABELS[editor.editingPreset]} wird vollständig durch den Plan von ${PRESET_LABELS[editor.pendingCopySource]} ersetzt.`;
          })()}
          confirmLabel="Überschreiben"
          variant="warning"
          onConfirm={editor.confirmCopyFrom}
          onCancel={() => editor.setPendingCopySource(null)}
        />
      </div>
    </Layout>
  );
}
