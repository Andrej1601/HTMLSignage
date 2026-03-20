import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SlideshowConfigPanel } from '@/components/Slideshow/SlideshowConfigPanel';
import { SlideshowWorkflowPanel } from '@/components/Slideshow/SlideshowWorkflowPanel';
import { useClearOverrides, useDevices, useSetOverrides, useUpdateDevice } from '@/hooks/useDevices';
import {
  useDeleteSlideshowHistoryEntry,
  useDiscardSlideshowDraft,
  usePublishSlideshow,
  useRollbackSlideshow,
  useSaveSlideshowDraft,
  useSlideshowWorkflow,
} from '@/hooks/useSlideshowWorkflow';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { Device } from '@/types/device.types';
import { getDeviceStatus, getModeLabel, getStatusColor, getStatusLabel } from '@/types/device.types';
import { createDefaultSlideshowConfig, type SlideshowConfig } from '@/types/slideshow.types';
import { getActiveEvent, type AudioSettings, type Settings } from '@/types/settings.types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { SectionCard } from '@/components/SectionCard';
import { EditorQualityAssistant } from '@/components/EditorQualityAssistant';
import { Button } from '@/components/Button';
import type { SlideshowWorkflowEntry, SlideshowWorkflowSnapshot } from '@/services/api';
import { Monitor, RefreshCw, Rocket, RotateCcw, Save, SlidersHorizontal, Undo2 } from 'lucide-react';

import { parseAudioSettings } from '@/utils/audioUtils';
import { getDeviceOverrideSettings } from '@/utils/deviceUtils';
import { getSlideshowQualityIssues } from '@/utils/editorQuality';
import {
  buildCurrentSlideshowSnapshot,
  buildSlideshowPreviewPayload,
  getDeviceSlideshowSource,
  getOverrideSlideshowConfig,
  hasStoredSlideshowOrAudioOverride,
  isScheduleOverride,
  normalizeEditorConfig,
  normalizePrestartMinutes,
  parseDeviceId,
  summarizeDeviceSlideshowSources,
  toDeviceTarget,
  type EditorTarget,
} from './slideshowPage.utils';

export function SlideshowPage() {
  const { settings, isLoading, error, refetch } = useSettings();
  const { schedule } = useSchedule();
  const { data: media = [] } = useMedia();
  const { data: devices = [] } = useDevices();
  const updateDevice = useUpdateDevice();
  const setOverrides = useSetOverrides();
  const clearOverrides = useClearOverrides();
  const saveDraft = useSaveSlideshowDraft();
  const discardDraft = useDiscardSlideshowDraft();
  const publishSlideshow = usePublishSlideshow();
  const rollbackSlideshow = useRollbackSlideshow();
  const deleteHistoryEntry = useDeleteSlideshowHistoryEntry();

  const pairedDevices = useMemo(
    () => devices.filter((device) => Boolean(device.pairedAt)),
    [devices]
  );

  const [target, setTarget] = useState<EditorTarget>('global');
  const [editorConfig, setEditorConfig] = useState<SlideshowConfig | null>(null);
  const [editorAudioOverride, setEditorAudioOverride] = useState<AudioSettings | null>(null);
  const [editorPrestartMinutes, setEditorPrestartMinutes] = useState(10);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'switch-target'; nextTarget: EditorTarget }
    | { type: 'reset' }
    | { type: 'delete-history'; entry: SlideshowWorkflowEntry }
    | null
  >(null);

  const selectedDeviceId = parseDeviceId(target);
  const selectedDevice = useMemo(
    () => pairedDevices.find((device) => device.id === selectedDeviceId) || null,
    [pairedDevices, selectedDeviceId]
  );
  const workflowTargetType = selectedDevice ? 'device' : 'global';
  const workflowState = useSlideshowWorkflow(workflowTargetType, selectedDevice?.id);

  const previewSchedule = schedule || createDefaultSchedule();
  const activeEvent = useMemo(() => (settings ? getActiveEvent(settings, new Date()) : null), [settings]);

  const deviceSourceSummary = useMemo(() => {
    return summarizeDeviceSlideshowSources(pairedDevices);
  }, [pairedDevices]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    if (selectedDevice) return;
    setTarget('global');
    setIsDirty(false);
  }, [selectedDevice, selectedDeviceId]);

  const loadEditorFromTarget = useCallback((targetToLoad: EditorTarget, draftSnapshot?: SlideshowWorkflowSnapshot | null) => {
    if (!settings) return;

    if (targetToLoad === 'global') {
      const liveConfig = settings.slideshow || createDefaultSlideshowConfig();
      const config = draftSnapshot?.config
        ? normalizeEditorConfig(draftSnapshot.config, liveConfig)
        : liveConfig;
      setEditorConfig(config);
      setEditorAudioOverride(null);
      setEditorPrestartMinutes(normalizePrestartMinutes(
        draftSnapshot?.prestartMinutes ?? settings.display?.prestartMinutes,
        10,
      ));
      setIsDirty(false);
      return;
    }

    const deviceId = parseDeviceId(targetToLoad);
    const device = pairedDevices.find((entry) => entry.id === deviceId) || null;
    const fallback = settings.slideshow || createDefaultSlideshowConfig();

    if (draftSnapshot?.config) {
      setEditorConfig(normalizeEditorConfig(draftSnapshot.config, fallback));
      setEditorAudioOverride(draftSnapshot.audioOverride ? parseAudioSettings(draftSnapshot.audioOverride) : null);
      setEditorPrestartMinutes(normalizePrestartMinutes(draftSnapshot.prestartMinutes, settings.display?.prestartMinutes));
      setIsDirty(false);
      return;
    }

    const overrideConfig = getOverrideSlideshowConfig(device, fallback);
    setEditorConfig(overrideConfig || fallback);
    setEditorAudioOverride(parseAudioSettings(getDeviceOverrideSettings(device).audio));
    const overrideSettings = getDeviceOverrideSettings(device);
    const overridePrestart = (overrideSettings.display as Record<string, unknown> | undefined)?.prestartMinutes;
    setEditorPrestartMinutes(normalizePrestartMinutes(
      overridePrestart ?? settings.display?.prestartMinutes,
      10,
    ));
    setIsDirty(false);
  }, [pairedDevices, settings]);

  useEffect(() => {
    if (!settings || isDirty) return;
    const draftSnapshot = workflowState.data?.draft?.snapshot || null;
    loadEditorFromTarget(target, draftSnapshot);
  }, [
    settings,
    target,
    selectedDevice?.updatedAt,
    workflowState.data?.draft?.snapshot,
    workflowState.data?.draft?.id,
    workflowState.data?.live.updatedAt,
    isDirty,
    loadEditorFromTarget,
  ]);

  const previewPayload = useMemo(() => {
    return buildSlideshowPreviewPayload({
      settings,
      previewSchedule,
      editorConfig,
      editorPrestartMinutes,
      isDirty,
      selectedDevice,
      editorAudioOverride,
    });
  }, [editorAudioOverride, editorConfig, editorPrestartMinutes, isDirty, previewSchedule, selectedDevice, settings]);

  const slideshowQualityIssues = useMemo(() => getSlideshowQualityIssues({
    config: editorConfig,
    settings: previewPayload?.settings || settings,
    media,
    audioOverride: selectedDevice ? editorAudioOverride : null,
  }), [editorAudioOverride, editorConfig, media, previewPayload?.settings, selectedDevice, settings]);

  const currentSnapshot = useMemo<SlideshowWorkflowSnapshot | null>(() => {
    return buildCurrentSlideshowSnapshot({
      editorConfig,
      editorPrestartMinutes,
      selectedDevice,
      editorAudioOverride,
    });
  }, [editorAudioOverride, editorConfig, editorPrestartMinutes, selectedDevice]);

  const hasActiveDeviceTarget = Boolean(selectedDevice);
  const hasRemovableOverride = hasStoredSlideshowOrAudioOverride(selectedDevice);
  const hasSavedDraft = Boolean(workflowState.data?.draft);
  const workflowBusy = saveDraft.isPending
    || discardDraft.isPending
    || publishSlideshow.isPending
    || rollbackSlideshow.isPending
    || deleteHistoryEntry.isPending;
  const isBusy = workflowBusy || workflowState.isFetching || setOverrides.isPending || clearOverrides.isPending || updateDevice.isPending;
  const canPublish = Boolean(currentSnapshot) && (isDirty || hasSavedDraft);

  const handleSelectTarget = (nextTarget: EditorTarget) => {
    if (nextTarget === target) return;

    if (isDirty) {
      setConfirmAction({ type: 'switch-target', nextTarget });
      return;
    }

    setTarget(nextTarget);
    setIsDirty(false);
  };

  const handleReloadCurrent = () => {
    if (isDirty) {
      setConfirmAction({ type: 'reset' });
      return;
    }

    loadEditorFromTarget(target, workflowState.data?.draft?.snapshot || null);
  };

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    if (confirmAction.type === 'switch-target') {
      setTarget(confirmAction.nextTarget);
      setIsDirty(false);
    } else if (confirmAction.type === 'reset') {
      loadEditorFromTarget(target, workflowState.data?.draft?.snapshot || null);
    } else if (confirmAction.type === 'delete-history') {
      deleteHistoryEntry.mutate({
        targetType: workflowTargetType,
        targetId: selectedDevice?.id,
        historyId: confirmAction.entry.id,
      });
    }

    setConfirmAction(null);
  }, [confirmAction, deleteHistoryEntry, loadEditorFromTarget, selectedDevice?.id, target, workflowState.data?.draft?.snapshot, workflowTargetType]);

  const handleSaveDraftCurrent = () => {
    if (!currentSnapshot) return;

    saveDraft.mutate(
      {
        targetType: workflowTargetType,
        targetId: selectedDevice?.id,
        snapshot: currentSnapshot,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
        },
      },
    );
  };

  const handlePublishCurrent = () => {
    if (!currentSnapshot) return;

    publishSlideshow.mutate(
      {
        targetType: workflowTargetType,
        targetId: selectedDevice?.id,
        snapshot: currentSnapshot,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          void refetch();
        },
      },
    );
  };

  const handleDiscardCurrentDraft = () => {
    discardDraft.mutate(
      {
        targetType: workflowTargetType,
        targetId: selectedDevice?.id,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          void refetch();
          loadEditorFromTarget(target, null);
        },
      },
    );
  };

  const handleLoadHistoryEntry = (entry: SlideshowWorkflowEntry) => {
    loadEditorFromTarget(target, entry.snapshot);
    setIsDirty(true);
  };

  const handleRollbackEntry = (entry: SlideshowWorkflowEntry) => {
    rollbackSlideshow.mutate(
      {
        targetType: workflowTargetType,
        targetId: selectedDevice?.id,
        sourceHistoryId: entry.id,
        snapshot: entry.snapshot,
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          void refetch();
        },
      },
    );
  };

  const handleDeleteHistoryEntry = (entry: SlideshowWorkflowEntry) => {
    setConfirmAction({ type: 'delete-history', entry });
  };

  const handleRemoveCurrentOverride = () => {
    if (!selectedDevice) return;

    const currentSettingsOverride = getDeviceOverrideSettings(selectedDevice);
    delete currentSettingsOverride.slideshow;
    delete currentSettingsOverride.audio;

    const hasRemainingSettingsOverride = Object.keys(currentSettingsOverride).length > 0;
    const existingSchedule = selectedDevice.overrides?.schedule;
    const scheduleOverride = isScheduleOverride(existingSchedule) ? existingSchedule : undefined;

    if (hasRemainingSettingsOverride || scheduleOverride) {
      const nextSettingsOverride = hasRemainingSettingsOverride
        ? currentSettingsOverride as Partial<Settings>
        : {};

      setOverrides.mutate(
        {
          id: selectedDevice.id,
          overrides: {
            settings: nextSettingsOverride,
            schedule: scheduleOverride,
          },
        },
        {
          onSuccess: () => {
            loadEditorFromTarget(target, null);
          },
        },
      );
      return;
    }

    clearOverrides.mutate(selectedDevice.id, {
      onSuccess: () => {
        loadEditorFromTarget(target, null);
      },
    });
  };

  const handleDeviceModeChange = (device: Device, mode: 'auto' | 'override') => {
    if (device.mode === mode) return;

    updateDevice.mutate({
      id: device.id,
      updates: { mode },
    });
  };

  if (isLoading || !settings || !editorConfig || !previewPayload) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Slideshow-Konfiguration..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <ErrorAlert error={error} onRetry={() => refetch()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Slideshow Konfiguration"
          description={
            hasActiveDeviceTarget
              ? `Override-Workflow für ${selectedDevice?.name || 'Gerät'}`
              : 'Globaler Workflow mit Entwurf und Veröffentlichung'
          }
          icon={SlidersHorizontal}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" icon={RefreshCw} onClick={handleReloadCurrent} disabled={isBusy}>
                Zurücksetzen
              </Button>

              {hasActiveDeviceTarget && (
                <Button variant="secondary" icon={RotateCcw} onClick={handleRemoveCurrentOverride} disabled={isBusy || !hasRemovableOverride}>
                  Override entfernen
                </Button>
              )}

              {hasSavedDraft && (
                <Button variant="ghost" icon={Undo2} onClick={handleDiscardCurrentDraft} disabled={isBusy}>
                  Entwurf verwerfen
                </Button>
              )}

              <Button
                variant="secondary"
                icon={Save}
                onClick={handleSaveDraftCurrent}
                disabled={!isDirty || isBusy}
                loading={saveDraft.isPending}
                loadingText="Speichere Entwurf..."
              >
                Entwurf speichern
              </Button>

              <Button
                icon={Rocket}
                onClick={handlePublishCurrent}
                disabled={!canPublish || isBusy}
                loading={publishSlideshow.isPending}
                loadingText="Veröffentliche..."
              >
                Live veröffentlichen
              </Button>
            </div>
          }
        />

        {isDirty && (
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
          description={selectedDevice
            ? `Prüft das aktuelle Override für ${selectedDevice.name} auf leere Zonen, tote Referenzen und Audio-Probleme.`
            : 'Prüft die globale Slideshow auf ausspielbare Slides, vollständige Zonen und gültige Referenzen.'}
          issues={slideshowQualityIssues}
          okMessage={selectedDevice
            ? `Das Override für ${selectedDevice.name} ist aktuell ohne erkennbare Konfigurationsprobleme aufgebaut.`
            : 'Die globale Slideshow ist aktuell ohne erkennbare Konfigurationsprobleme aufgebaut.'}
        />

        <SectionCard
          title="Geräte-Ausspielung"
          description="Wähle ein Ziel, um globale Slideshow oder Geräte-Override zu bearbeiten."
          icon={Monitor}
          actions={
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-spa-success-light px-3 py-1 text-spa-success-dark">
                Global: {deviceSourceSummary.global}
              </span>
              <span className="rounded-full bg-spa-info-light px-3 py-1 text-spa-info-dark">
                Override aktiv: {deviceSourceSummary.overrideActive}
              </span>
              <span className="rounded-full bg-spa-warning-light px-3 py-1 text-spa-warning-dark">
                Override hinterlegt: {deviceSourceSummary.overrideStoredInactive}
              </span>
              {deviceSourceSummary.overrideModeWithoutData > 0 && (
                <span className="rounded-full bg-spa-error-light px-3 py-1 text-spa-error-dark">
                  Modus Override ohne Daten: {deviceSourceSummary.overrideModeWithoutData}
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-1.5">
            <div
              onClick={() => handleSelectTarget('global')}
              className={`rounded-lg border px-4 py-2.5 cursor-pointer transition-colors ${
                target === 'global'
                  ? 'border-spa-primary bg-spa-primary/5'
                  : 'border-spa-bg-secondary hover:border-spa-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-4 w-4 text-spa-primary flex-shrink-0" />
                <span className="font-semibold text-sm text-spa-text-primary flex-1">Globale Slideshow</span>
                {target === 'global' && workflowState.data?.draft && (
                  <StatusBadge label="Entwurf" tone="warning" showDot={false} />
                )}
                {target === 'global' && (
                  <StatusBadge label="Im Editor" tone="success" showDot={false} />
                )}
              </div>
              {target === 'global' && (
                <p className="text-xs text-spa-text-secondary mt-1 ml-7">
                  Standard-Konfiguration für alle Geräte im Auto-Modus
                </p>
              )}
            </div>

            {pairedDevices.length === 0 ? (
              <div className="rounded-lg border border-spa-bg-secondary bg-spa-bg-primary/40 px-4 py-6 text-center text-sm text-spa-text-secondary">
                <Monitor className="w-8 h-8 text-spa-text-secondary mx-auto mb-2" />
                Keine gekoppelten Displays vorhanden.
              </div>
            ) : (
              pairedDevices.map((device) => {
                const source = getDeviceSlideshowSource(device);
                const status = getDeviceStatus(device.lastSeen);
                const statusColor = getStatusColor(status);
                const isSelected = target === toDeviceTarget(device.id);

                return (
                  <div
                    key={device.id}
                    onClick={() => handleSelectTarget(toDeviceTarget(device.id))}
                    className={`rounded-lg border px-4 py-2.5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-spa-primary bg-spa-primary/5'
                        : 'border-spa-bg-secondary hover:border-spa-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {getStatusLabel(status)}
                      </span>
                      <span className="font-semibold text-sm text-spa-text-primary flex-1 min-w-0 truncate">{device.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={device.mode}
                          onChange={(event) => handleDeviceModeChange(device, event.target.value as 'auto' | 'override')}
                          disabled={updateDevice.isPending}
                          className="rounded-lg border border-spa-bg-secondary px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-spa-primary disabled:opacity-60"
                        >
                          <option value="auto">{getModeLabel('auto')}</option>
                          <option value="override">{getModeLabel('override')}</option>
                        </select>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${source.badgeClass}`}>
                        {source.label}
                      </span>
                      {isSelected && workflowState.data?.draft && (
                        <StatusBadge label="Entwurf" tone="warning" showDot={false} />
                      )}
                      {isSelected && (
                        <StatusBadge label="Im Editor" tone="success" showDot={false} />
                      )}
                    </div>
                    {isSelected && (
                      <p className="text-xs text-spa-text-secondary mt-1 ml-[72px]">{source.detail}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>

        {workflowState.data && (
          <SlideshowWorkflowPanel
            targetLabel={workflowState.data.target.name}
            targetType={workflowTargetType}
            liveUpdatedAt={workflowState.data.live.updatedAt}
            liveSettingsVersion={workflowState.data.live.settingsVersion}
            draft={workflowState.data.draft}
            history={workflowState.data.history}
            activeEvent={activeEvent}
            schedule={schedule}
            selectedDevice={selectedDevice}
            disabled={isBusy}
            isWorking={workflowBusy}
            onDiscardDraft={handleDiscardCurrentDraft}
            onLoadHistoryEntry={handleLoadHistoryEntry}
            onRollbackEntry={handleRollbackEntry}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
          />
        )}

        <SlideshowConfigPanel
          config={editorConfig}
          onChange={(nextConfig) => {
            setEditorConfig(nextConfig);
            setIsDirty(true);
          }}
          prestartMinutes={editorPrestartMinutes}
          onPrestartMinutesChange={(minutes) => {
            setEditorPrestartMinutes(normalizePrestartMinutes(minutes, editorPrestartMinutes));
            setIsDirty(true);
          }}
          previewSchedule={previewPayload.schedule}
          previewSettings={previewPayload.settings}
          scenarioDefaultDeviceId={selectedDevice?.id || null}
          scenarioAllowedDeviceIds={selectedDevice ? [selectedDevice.id] : undefined}
          isDirty={isDirty}
          disabled={isBusy}
          showAudioOverride={Boolean(selectedDevice)}
          audioOverride={editorAudioOverride}
          onAudioOverrideChange={selectedDevice ? ((audio) => {
            setEditorAudioOverride(audio);
            setIsDirty(true);
          }) : undefined}
          audioTitle={selectedDevice ? `Geräte-Musik (${selectedDevice.name})` : 'Audio-Override'}
          audioSubtitle={selectedDevice
            ? 'Überschreibt globale Musik nur für dieses Display.'
            : 'Musik für diese Slideshow-Ausgabe konfigurieren.'}
          audioEnableLabel="Musik für dieses Gerät aktivieren"
          audioEnableDescription="Wird nur genutzt, wenn der Gerätemodus auf Überschrieben steht."
        />

        <ConfirmDialog
          isOpen={confirmAction !== null}
          title={confirmAction?.type === 'delete-history' ? 'Stand löschen' : 'Ungespeicherte Änderungen'}
          message={
            confirmAction?.type === 'switch-target'
              ? 'Ungespeicherte Änderungen verwerfen und Ziel wechseln?'
              : confirmAction?.type === 'delete-history'
                ? 'Diesen Stand nur aus der Verlaufsliste löschen? Der aktuelle Live-Stand bleibt unverändert.'
                : 'Ungespeicherte Änderungen verwerfen?'
          }
          confirmLabel={confirmAction?.type === 'delete-history' ? 'Löschen' : 'Verwerfen'}
          variant="warning"
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      </div>
    </Layout>
  );
}
