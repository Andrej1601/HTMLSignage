import { Layout } from '@/components/Layout';
import { SkeletonCard } from '@/components/Skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { SlideshowSelector } from '@/components/Slideshow/SlideshowSelector';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { CheckCircle2, RefreshCw, Save, SlidersHorizontal } from 'lucide-react';
import { useSlideshowEditor } from '@/hooks/useSlideshowEditor';

export function SlideshowPage() {
  const editor = useSlideshowEditor();

  if (editor.isLoading || !editor.settings || !editor.editorConfig || !editor.previewPayload) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="h-12 animate-pulse rounded-xl bg-spa-bg-secondary" />
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

        <SlideshowSelector
          slideshows={editor.slideshows}
          selectedId={editor.selectedSlideshowId}
          disabled={editor.isBusy}
          onSelect={editor.handleSelectSlideshow}
          onCreate={editor.handleCreateSlideshow}
          onRename={editor.handleRenameSlideshow}
          onDelete={editor.handleDeleteSlideshow}
        />

        {editor.isDirty && (
          <div className="flex items-center gap-3 rounded-lg border-2 border-spa-warning bg-spa-warning-light px-5 py-3">
            <span className="inline-flex h-3 w-3 rounded-full bg-spa-warning" />
            <span className="text-sm font-semibold text-spa-warning-dark">
              Ungespeicherte Änderungen — speichern nicht vergessen.
            </span>
          </div>
        )}

        {editor.slideshowQualityIssues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-spa-success/20 bg-spa-success-light/70 px-4 py-2.5 text-sm text-spa-success-dark">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">Qualitätscheck bestanden</span>
          </div>
        ) : (
          <EditorQualityAssistant
            description={`Prüft „${editor.selectedSlideshow?.name || 'Slideshow'}" auf leere Zonen, tote Referenzen und Audio-Probleme.`}
            issues={editor.slideshowQualityIssues}
            okMessage=""
          />
        )}

        <SlideshowConfigPanel
          config={editor.editorConfig!}
          onChange={editor.handleConfigChange}
          prestartMinutes={editor.editorPrestartMinutes}
          onPrestartMinutesChange={editor.handlePrestartMinutesChange}
          previewSchedule={editor.previewPayload!.schedule}
          previewSettings={editor.previewPayload!.settings}
          scenarioDefaultDeviceId={null}
          isDirty={editor.isDirty}
          disabled={editor.isBusy}
          showAudioOverride={false}
          audioOverride={null}
          onAudioOverrideChange={undefined}
        />

        <ConfirmDialog
          isOpen={editor.confirmAction !== null}
          title={
            editor.confirmAction?.type === 'delete-slideshow'
              ? 'Slideshow löschen'
              : 'Ungespeicherte Änderungen'
          }
          message={
            editor.confirmAction?.type === 'switch-slideshow'
              ? 'Ungespeicherte Änderungen verwerfen und Slideshow wechseln?'
              : editor.confirmAction?.type === 'delete-slideshow'
                ? `„${editor.confirmAction.slideshow.name}" wirklich löschen? Zugewiesene Geräte werden auf die Standard-Slideshow zurückgesetzt.`
                : 'Ungespeicherte Änderungen verwerfen?'
          }
          confirmLabel={editor.confirmAction?.type === 'delete-slideshow' ? 'Löschen' : 'Verwerfen'}
          variant={editor.confirmAction?.type === 'delete-slideshow' ? 'danger' : 'warning'}
          onConfirm={editor.handleConfirmAction}
          onCancel={() => editor.setConfirmAction(null)}
        />
      </div>
    </Layout>
  );
}

// --- Sub-components ---

function SlideshowHeader({ editor }: { editor: ReturnType<typeof useSlideshowEditor> }) {
  return (
    <PageHeader
      title="Slideshow Konfiguration"
      description={
        editor.selectedSlideshow
          ? `Bearbeite „${editor.selectedSlideshow.name}"${editor.selectedSlideshow.isDefault ? ' (Standard)' : ''}`
          : 'Wähle eine Slideshow zum Bearbeiten'
      }
      icon={SlidersHorizontal}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={editor.handleReloadCurrent}
            disabled={!editor.isDirty || editor.isBusy}
          >
            Zurücksetzen
          </Button>

          <Button
            icon={Save}
            onClick={editor.handleSaveCurrent}
            disabled={!editor.isDirty || editor.isBusy}
            loading={editor.updateSlideshow.isPending}
            loadingText="Speichert..."
          >
            Speichern
          </Button>
        </div>
      }
    />
  );
}
