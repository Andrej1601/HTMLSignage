import { useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid';
import { ScheduleStackView } from '@/components/Schedule/ScheduleStackView';
import { CellEditor } from '@/components/Schedule/CellEditor';
import { TimeEditor } from '@/components/Schedule/TimeEditor';
import { PRESET_LABELS } from '@/types/schedule.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { VersionConflictDialog } from '@/components/VersionConflictDialog';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { DraftRecoveryBanner } from '@/components/DraftRecoveryBanner';
import { Save, Calendar, RefreshCw } from 'lucide-react';
import { useCommandPaletteActions } from '@/hooks/useCommandPaletteActions';
import { useScheduleEditor } from '@/hooks/useScheduleEditor';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useDirtyRegistry } from '@/hooks/useDirtyRegistry';
import { PresetTabs } from '@/components/Schedule/PresetTabs';
import { AutosaveIndicator } from '@/components/AutosaveIndicator';
import clsx from 'clsx';

function SchedulePageSkeleton() {
  return (
    <Layout>
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-spa-bg-secondary" />
        <div className="h-10 animate-pulse rounded-xl bg-spa-bg-secondary" />
        <div className="rounded-xl border border-spa-bg-secondary bg-spa-surface p-6 space-y-4">
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
  useSaveShortcut(editor.handleSave, { enabled: !editor.isSaving, isDirty: editor.isDirty });
  useDirtyRegistry(editor.isDirty);

  if (editor.isLoading || !editor.localSchedule) return <SchedulePageSkeleton />;
  if (editor.error) return <SchedulePageError error={editor.error} onRetry={() => editor.refetch()} />;

  return (
    <Layout>
      <div className="space-y-4">

        {/* ── Header — vereinheitlicht über PageHeader ── */}
        <PageHeader
          title="Aufgussplan"
          description={`Live aktiv: ${PRESET_LABELS[editor.livePreset]}. In Bearbeitung: ${PRESET_LABELS[editor.editingPreset]}.`}
          icon={Calendar}
          badges={[
            {
              label: editor.localSchedule.autoPlay ? 'Auto-Play aktiv' : 'Manueller Modus',
              tone: editor.localSchedule.autoPlay ? 'success' : 'warning',
            },
            {
              label: editor.isDirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert',
              tone: editor.isDirty ? 'warning' : 'success',
            },
          ]}
          actions={(
            <>
              <AutosaveIndicator isDirty={editor.isDirty} lastAutoSavedAt={editor.draftState.lastAutoSavedAt} />

              {/* Auto-Play Toggle bewusst im Action-Slot — Saunameister-
                  Workflow erwartet ihn am Header-Rechtsrand neben Save. */}
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-spa-text-secondary">Auto-Play</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editor.localSchedule.autoPlay}
                  onClick={editor.handleAutoPlayToggle}
                  className={clsx(
                    'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                    editor.localSchedule.autoPlay ? 'bg-spa-success' : 'bg-spa-bg-secondary',
                  )}
                >
                  <span
                    className={clsx(
                      'pointer-events-none inline-block h-4 w-4 rounded-full bg-spa-surface shadow-sm transition-transform duration-200',
                      editor.localSchedule.autoPlay ? 'translate-x-4' : 'translate-x-0',
                    )}
                  />
                </button>
              </label>

              <Button
                variant="ghost"
                icon={RefreshCw}
                onClick={() => {
                  editor.draftState.clearDraft();
                  editor.resetToLiveSchedule();
                }}
                disabled={!editor.isDirty}
                title="Ungespeicherte Änderungen verwerfen"
              >
                Reset
              </Button>

              <Button
                icon={Save}
                onClick={editor.handleSave}
                disabled={!editor.isDirty}
                loading={editor.isSaving}
                loadingText="Speichert…"
              >
                Speichern
              </Button>
            </>
          )}
        />

        {/* ── Dirty Banner ── */}
        {editor.isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-spa-warning bg-spa-warning-light px-4 py-2.5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-spa-warning opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-spa-warning" />
            </span>
            <span className="text-sm font-medium text-spa-warning-dark">Ungespeicherte Änderungen</span>
          </div>
        )}

        {/* ── Draft Recovery ── */}
        {editor.draftState.hasStoredDraft && !editor.isDirty && (
          <DraftRecoveryBanner
            entityLabel="Aufgussplan"
            updatedAt={editor.draftState.draftUpdatedAt}
            onRestore={editor.handleRestoreDraft}
            onDiscard={editor.handleDiscardDraft}
          />
        )}

        {/* ── Quality Assistant (compact) ── */}
        <EditorQualityAssistant
          description={`Plausibilitätschecks für ${PRESET_LABELS[editor.editingPreset]}.`}
          issues={editor.scheduleQualityIssues}
          okMessage={`Keine Probleme für ${PRESET_LABELS[editor.editingPreset]} erkannt.`}
        />

        {/* ── Preset Chip-Tabs ── */}
        <PresetTabs editor={editor} />

        {/* ── Grid ── */}
        {editor.currentDaySchedule && (
          <div className="overflow-hidden rounded-xl border border-spa-bg-secondary bg-spa-surface shadow-xs">
            {/* Grid title bar */}
            <div className="flex items-center justify-between border-b border-spa-bg-secondary bg-spa-bg-primary/40 px-4 py-2.5">
              <span className="text-sm font-semibold text-spa-text-primary">
                Tagesplan: {PRESET_LABELS[editor.editingPreset]}
              </span>
              <span className="text-xs text-spa-text-secondary">
                {editor.currentDaySchedule.rows.length} Zeitslot{editor.currentDaySchedule.rows.length !== 1 ? 's' : ''}
                {' · '}
                {editor.currentDaySchedule.saunas.length} Sauna{editor.currentDaySchedule.saunas.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Desktop: vollständige Matrix-Ansicht */}
            <div className="hidden lg:block">
              <ScheduleGrid
                daySchedule={editor.currentDaySchedule}
                aromas={editor.settings?.aromas || []}
                saunaColors={editor.saunaColors}
                saunaObjects={editor.settings?.saunas || []}
                onEditCell={editor.handleEditCell}
                onEditTime={editor.handleEditTime}
                onAddTimeRow={editor.handleAddTimeRow}
                onDeleteTimeRow={editor.handleDeleteTimeRow}
              />
            </div>
            {/* Mobile/Tablet: vertikaler Card-Stack */}
            <div className="lg:hidden">
              <ScheduleStackView
                daySchedule={editor.currentDaySchedule}
                aromas={editor.settings?.aromas || []}
                saunaColors={editor.saunaColors}
                saunaObjects={editor.settings?.saunas || []}
                onEditCell={editor.handleEditCell}
                onEditTime={editor.handleEditTime}
                onAddTimeRow={editor.handleAddTimeRow}
                onDeleteTimeRow={editor.handleDeleteTimeRow}
              />
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between border-t border-spa-bg-secondary bg-spa-bg-primary/30 px-4 py-2">
              <span className="text-xs text-spa-text-secondary">
                Version {editor.localSchedule.version}
                {editor.schedule?.version !== editor.localSchedule.version && (
                  <span className="ml-2 text-spa-warning font-medium">· nicht gespeichert</span>
                )}
              </span>
              {editor.scheduleQualityIssues.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-spa-warning-dark">
                  <span className="h-1.5 w-1.5 rounded-full bg-spa-warning" />
                  {editor.scheduleQualityIssues.length} Hinweis{editor.scheduleQualityIssues.length !== 1 ? 'e' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Modals ── */}
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

        <VersionConflictDialog
          isOpen={editor.conflictInfo !== null}
          entityLabel="Aufgussplan"
          localVersion={editor.localSchedule?.version ?? null}
          serverVersion={editor.conflictInfo?.latestVersion ?? editor.schedule?.version ?? null}
          onClose={() => editor.setConflictInfo(null)}
          onAcceptServer={editor.handleAcceptServer}
          onForceSave={editor.conflictInfo?.latestVersion != null ? editor.handleForceSave : undefined}
          isForcing={editor.isForcingSave}
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
