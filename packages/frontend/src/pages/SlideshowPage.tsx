import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { SlideshowWorkflowPanel } from '@/components/Slideshow/SlideshowWorkflowPanel';
import { SlideshowTargetSelector } from '@/components/Slideshow/SlideshowTargetSelector';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { RefreshCw, Rocket, RotateCcw, Save, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useSlideshowEditor } from '@/hooks/useSlideshowEditor';

export function SlideshowPage() {
  const editor = useSlideshowEditor();

  if (editor.isLoading || !editor.settings || !editor.editorConfig || !editor.previewPayload) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Slideshow-Konfiguration..." />
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
        <PageHeader
          title="Slideshow Konfiguration"
          description={
            editor.hasActiveDeviceTarget
              ? `Override-Workflow für ${editor.selectedDevice?.name || 'Gerät'}`
              : 'Globaler Workflow mit Entwurf und Veröffentlichung'
          }
          icon={SlidersHorizontal}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" icon={RefreshCw} onClick={editor.handleReloadCurrent} disabled={editor.isBusy}>
                Zurücksetzen
              </Button>

              {editor.hasActiveDeviceTarget && (
                <Button variant="secondary" icon={RotateCcw} onClick={editor.handleRemoveCurrentOverride} disabled={editor.isBusy || !editor.hasRemovableOverride}>
                  Override entfernen
                </Button>
              )}

              {editor.hasSavedDraft && (
                <Button variant="ghost" icon={Undo2} onClick={editor.handleDiscardCurrentDraft} disabled={editor.isBusy}>
                  Entwurf verwerfen
                </Button>
              )}

              <Button
                variant="secondary"
                icon={Save}
                onClick={editor.handleSaveDraftCurrent}
                disabled={!editor.isDirty || editor.isBusy}
                loading={editor.saveDraft.isPending}
                loadingText="Speichere Entwurf..."
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
            </div>
          }
        />

        {editor.isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-amber-400 bg-amber-50 px-5 py-3 shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
            </span>
            <span className="text-sm font-semibold text-amber-800">
              Ungespeicherte Änderungen — als Entwurf sichern oder direkt bewusst live veröffentlichen.
            </span>
          </div>
        )}

        <EditorQualityAssistant
          description={editor.selectedDevice
            ? `Prüft das aktuelle Override für ${editor.selectedDevice.name} auf leere Zonen, tote Referenzen und Audio-Probleme.`
            : 'Prüft die globale Slideshow auf ausspielbare Slides, vollständige Zonen und gültige Referenzen.'}
          issues={editor.slideshowQualityIssues}
          okMessage={editor.selectedDevice
            ? `Das Override für ${editor.selectedDevice.name} ist aktuell ohne erkennbare Konfigurationsprobleme aufgebaut.`
            : 'Die globale Slideshow ist aktuell ohne erkennbare Konfigurationsprobleme aufgebaut.'}
        />

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

        <SlideshowConfigPanel
          config={editor.editorConfig}
          onChange={editor.handleConfigChange}
          prestartMinutes={editor.editorPrestartMinutes}
          onPrestartMinutesChange={editor.handlePrestartMinutesChange}
          previewSchedule={editor.previewPayload.schedule}
          previewSettings={editor.previewPayload.settings}
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
