import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useClearOverrides,
  useDevices,
  useSetOverrides,
  useUpdateDevice,
} from '@/hooks/useDevices';
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
import { createDefaultSlideshowConfig, type SlideshowConfig } from '@/types/slideshow.types';
import { getActiveEvent, type AudioSettings, type Settings } from '@/types/settings.types';
import type { SlideshowWorkflowEntry, SlideshowWorkflowSnapshot } from '@/services/api';
import { parseAudioSettings } from '@/utils/audioUtils';
import { getDeviceOverrideSettings } from '@/utils/deviceUtils';
import { getSlideshowQualityIssues } from '@/utils/editorQuality';
import {
  buildCurrentSlideshowSnapshot,
  buildSlideshowPreviewPayload,
  getOverrideSlideshowConfig,
  hasStoredSlideshowOrAudioOverride,
  isScheduleOverride,
  normalizeEditorConfig,
  normalizePrestartMinutes,
  parseDeviceId,
  type EditorTarget,
} from '@/pages/slideshowPage.utils';

type ConfirmAction =
  | { type: 'switch-target'; nextTarget: EditorTarget }
  | { type: 'reset' }
  | { type: 'delete-history'; entry: SlideshowWorkflowEntry }
  | null;

export function useSlideshowEditor() {
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
    [devices],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [target, setTarget] = useState<EditorTarget>(() => {
    const urlTarget = searchParams.get('target');
    if (urlTarget === 'global' || (urlTarget && urlTarget.startsWith('device:'))) {
      return urlTarget as EditorTarget;
    }
    return 'global';
  });
  const [editorConfig, setEditorConfig] = useState<SlideshowConfig | null>(null);
  const [editorAudioOverride, setEditorAudioOverride] = useState<AudioSettings | null>(null);
  const [editorPrestartMinutes, setEditorPrestartMinutes] = useState(10);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const selectedDeviceId = parseDeviceId(target);
  const selectedDevice = useMemo(
    () => pairedDevices.find((device) => device.id === selectedDeviceId) || null,
    [pairedDevices, selectedDeviceId],
  );
  const workflowTargetType: 'device' | 'global' = selectedDevice ? 'device' : 'global';
  const workflowState = useSlideshowWorkflow(workflowTargetType, selectedDevice?.id);

  const previewSchedule = schedule || createDefaultSchedule();
  const activeEvent = useMemo(() => (settings ? getActiveEvent(settings, new Date()) : null), [settings]);

  // Clear ?target= from URL after consuming it
  useEffect(() => {
    if (searchParams.has('target')) {
      setSearchParams((prev) => { prev.delete('target'); return prev; }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      { onSuccess: () => setIsDirty(false) },
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
        { onSuccess: () => loadEditorFromTarget(target, null) },
      );
      return;
    }

    clearOverrides.mutate(selectedDevice.id, {
      onSuccess: () => loadEditorFromTarget(target, null),
    });
  };

  const handleDeviceModeChange = (device: Device, mode: 'auto' | 'override') => {
    if (device.mode === mode) return;
    updateDevice.mutate({ id: device.id, updates: { mode } });
  };

  const handleConfigChange = (nextConfig: SlideshowConfig) => {
    setEditorConfig(nextConfig);
    setIsDirty(true);
  };

  const handlePrestartMinutesChange = (minutes: number) => {
    setEditorPrestartMinutes(normalizePrestartMinutes(minutes, editorPrestartMinutes));
    setIsDirty(true);
  };

  const handleAudioOverrideChange = selectedDevice
    ? (audio: AudioSettings | null) => {
        setEditorAudioOverride(audio);
        setIsDirty(true);
      }
    : undefined;

  return {
    // Data
    settings,
    schedule,
    isLoading,
    error,
    refetch,
    pairedDevices,
    selectedDevice,
    activeEvent,
    workflowState,
    previewPayload,
    slideshowQualityIssues,

    // Editor state
    target,
    editorConfig,
    editorAudioOverride,
    editorPrestartMinutes,
    isDirty,
    confirmAction,

    // Derived flags
    hasActiveDeviceTarget,
    hasRemovableOverride,
    hasSavedDraft,
    workflowBusy,
    isBusy,
    canPublish,
    workflowTargetType,

    // Mutation states
    saveDraft,
    publishSlideshow,

    // Handlers
    handleSelectTarget,
    handleReloadCurrent,
    handleConfirmAction,
    handleSaveDraftCurrent,
    handlePublishCurrent,
    handleDiscardCurrentDraft,
    handleLoadHistoryEntry,
    handleRollbackEntry,
    handleDeleteHistoryEntry,
    handleRemoveCurrentOverride,
    handleDeviceModeChange,
    handleConfigChange,
    handlePrestartMinutesChange,
    handleAudioOverrideChange,
    setConfirmAction,
  };
}
