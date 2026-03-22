import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { SkeletonCard } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { SlideshowWorkflowPanel } from '@/components/Slideshow/SlideshowWorkflowPanel';
import { SlideshowTargetSelector } from '@/components/Slideshow/SlideshowTargetSelector';
import { OverrideDiffView } from '@/components/Slideshow/OverrideDiffView';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { CheckCircle2, MoreVertical, RefreshCw, Rocket, RotateCcw, Save, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useSlideshowEditor } from '@/hooks/useSlideshowEditor';

export function SlideshowPage() {
  const editor = useSlideshowEditor();

  if (editor.isLoading || !editor.settings || !editor.editorConfig || !editor.previewPayload) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard className="h-80" />
            <SkeletonCard className="h-80" />
          </div>
        </div>
      </Layout>
    );
  }

  if (editor.error) {
    return (
      <Layout>
        <ErrorAlert error={editor.error} onRetry={() => editor.refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <SlideshowHeader editor={editor} />

        {editor.isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-sm font-semibold text-amber-800">
              Ungespeicherte Änderungen — als Entwurf sichern oder live veröffentlichen.
            </span>
          </div>
        )}

        {editor.slideshowQualityIssues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-spa-success/20 bg-spa-success-light/70 px-4 py-2.5 text-sm text-spa-success-dark">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">Qualitätscheck bestanden</span>
          </div>
        ) : (
          <EditorQualityAssistant
            description={editor.selectedDevice
              ? `Prüft das aktuelle Override für ${editor.selectedDevice.name} auf leere Zonen, tote Referenzen und Audio-Probleme.`
              : 'Prüft die globale Slideshow auf ausspielbare Slides, vollständige Zonen und gültige Referenzen.'}
            issues={editor.slideshowQualityIssues}
            okMessage=""
          />
        )}

        <SlideshowTabs editor={editor} />

        <ConfirmDialog
          isOpen={editor.confirmAction !== null}
          title={editor.confirmAction?.type === 'delete-history' ? 'Stand löschen' : 'Ungespeicherte Änderungen'}
          message={
            editor.confirmAction?.type === 'switch-target'
              ? 'Ungespeicherte Änderungen verwerfen und Ziel wechseln?'
              : editor.confirmAction?.type === 'delete-history'
                ? 'Diesen Stand nur aus der Verlaufsliste löschen? Der aktuelle Live-Stand bleibt unverändert.'
                : 'Ungespeicherte Änderungen verwerfen?'
          }
          confirmLabel={editor.confirmAction?.type === 'delete-history' ? 'Löschen' : 'Verwerfen'}
          variant="warning"
          onConfirm={editor.handleConfirmAction}
          onCancel={() => editor.setConfirmAction(null)}
        />
      </div>
    </Layout>
  );
}

// --- Sub-components ---

function SlideshowHeader({ editor }: { editor: ReturnType<typeof useSlideshowEditor> }) {
  const secondaryActions: { label: string; icon: typeof RefreshCw; onClick: () => void; variant?: 'danger' }[] = [
    { label: 'Zurücksetzen', icon: RefreshCw, onClick: editor.handleReloadCurrent },
  ];

  if (editor.hasActiveDeviceTarget && editor.hasRemovableOverride) {
    secondaryActions.push({ label: 'Override entfernen', icon: RotateCcw, onClick: editor.handleRemoveCurrentOverride });
  }

  if (editor.hasSavedDraft) {
    secondaryActions.push({ label: 'Entwurf verwerfen', icon: Undo2, onClick: editor.handleDiscardCurrentDraft });
  }

  return (
    <PageHeader
      title="Slideshow Konfiguration"
      description={
        editor.hasActiveDeviceTarget
          ? `Override-Workflow für ${editor.selectedDevice?.name || 'Gerät'}`
          : 'Globaler Workflow mit Entwurf und Veröffentlichung'
      }
      icon={SlidersHorizontal}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={Save}
            onClick={editor.handleSaveDraftCurrent}
            disabled={!editor.isDirty || editor.isBusy}
            loading={editor.saveDraft.isPending}
            loadingText="Speichert..."
          >
            Entwurf speichern
          </Button>

          <Button
            icon={Rocket}
            onClick={editor.handlePublishCurrent}
            disabled={!editor.canPublish || editor.isBusy}
            loading={editor.publishSlideshow.isPending}
            loadingText="Veröffentliche..."
          >
            Live veröffentlichen
          </Button>

          <DropdownMenu
            sections={[secondaryActions.map((action) => ({
              label: action.label,
              icon: action.icon,
              onClick: action.onClick,
              variant: action.variant,
            }))]}
            ariaLabel="Weitere Aktionen"
            trigger={(open) => (
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-lg border p-2 transition-colors ${
                  open
                    ? 'border-spa-primary/30 bg-spa-primary/10 text-spa-primary'
                    : 'border-spa-bg-secondary bg-white text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary'
                }`}
                aria-label="Weitere Aktionen"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
          />
        </div>
      }
    />
  );
}

function SlideshowTabs({ editor }: { editor: ReturnType<typeof useSlideshowEditor> }) {
  const [tab, setTab] = useState<'editor' | 'workflow'>('editor');

  return (
    <>
      <div className="flex gap-1 rounded-xl border border-spa-bg-secondary bg-spa-bg-primary p-1">
        <button
          type="button"
          onClick={() => setTab('editor')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'editor'
              ? 'bg-white text-spa-text-primary shadow-sm'
              : 'text-spa-text-secondary hover:text-spa-text-primary'
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setTab('workflow')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'workflow'
              ? 'bg-white text-spa-text-primary shadow-sm'
              : 'text-spa-text-secondary hover:text-spa-text-primary'
          }`}
        >
          Workflow & Ziele
        </button>
      </div>

      {tab === 'editor' ? (
        <SlideshowConfigPanel
          config={editor.editorConfig!}
          onChange={editor.handleConfigChange}
          prestartMinutes={editor.editorPrestartMinutes}
          onPrestartMinutesChange={editor.handlePrestartMinutesChange}
          previewSchedule={editor.previewPayload!.schedule}
          previewSettings={editor.previewPayload!.settings}
          scenarioDefaultDeviceId={editor.selectedDevice?.id || null}
          scenarioAllowedDeviceIds={editor.selectedDevice ? [editor.selectedDevice.id] : undefined}
          isDirty={editor.isDirty}
          disabled={editor.isBusy}
          showAudioOverride={Boolean(editor.selectedDevice)}
          audioOverride={editor.editorAudioOverride}
          onAudioOverrideChange={editor.handleAudioOverrideChange}
          audioTitle={editor.selectedDevice ? `Geräte-Musik (${editor.selectedDevice.name})` : 'Audio-Override'}
          audioSubtitle={editor.selectedDevice
            ? 'Überschreibt globale Musik nur für dieses Display.'
            : 'Musik für diese Slideshow-Ausgabe konfigurieren.'}
          audioEnableLabel="Musik für dieses Gerät aktivieren"
          audioEnableDescription="Wird nur genutzt, wenn der Gerätemodus auf Überschrieben steht."
        />
      ) : (
        <div className="space-y-6">
          <SlideshowTargetSelector
            target={editor.target}
            pairedDevices={editor.pairedDevices}
            draft={editor.workflowState.data?.draft || null}
            disabled={editor.isBusy}
            onSelectTarget={editor.handleSelectTarget}
            onDeviceModeChange={editor.handleDeviceModeChange}
          />

          {editor.workflowState.data && (
            <SlideshowWorkflowPanel
              targetLabel={editor.workflowState.data.target.name}
              targetType={editor.workflowTargetType}
              liveUpdatedAt={editor.workflowState.data.live.updatedAt}
              liveSettingsVersion={editor.workflowState.data.live.settingsVersion}
              draft={editor.workflowState.data.draft}
              history={editor.workflowState.data.history}
              activeEvent={editor.activeEvent}
              schedule={editor.schedule}
              selectedDevice={editor.selectedDevice}
              disabled={editor.isBusy}
              isWorking={editor.workflowBusy}
              onDiscardDraft={editor.handleDiscardCurrentDraft}
              onLoadHistoryEntry={editor.handleLoadHistoryEntry}
              onRollbackEntry={editor.handleRollbackEntry}
              onDeleteHistoryEntry={editor.handleDeleteHistoryEntry}
            />
          )}

          {editor.hasActiveDeviceTarget && editor.settings && editor.editorConfig && (
            <OverrideDiffView
              globalConfig={editor.settings.slideshow || createDefaultSlideshowConfig()}
              overrideConfig={editor.editorConfig}
            />
          )}
        </div>
      )}
    </>
  );
}
