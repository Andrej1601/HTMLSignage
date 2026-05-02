import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { usePersistentEditorDraft } from '@/hooks/usePersistentEditorDraft';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/stores/toastStore';
import { extractVersionConflict } from '@/utils/versionConflict';
import { getActiveEvent } from '@/types/settings.types';
import type { Schedule, PresetKey, Entry } from '@/types/schedule.types';
import type { Sauna } from '@/types/sauna.types';
import {
  getTodayPresetKey,
  resolveLivePresetKey,
  syncScheduleWithSaunas,
  PRESET_LABELS,
} from '@/types/schedule.types';
import { getScheduleQualityIssues } from '@/utils/editorQuality';
import {
  resolveInitialEditingPreset,
  withAddedTimeRow,
  withAutoPlayToggled,
  withCellEntry,
  withCopiedPreset,
  withDeletedTimeRow,
  withIncrementedScheduleVersion,
  withManualActivePreset,
  withUpdatedTimeRow,
} from '@/pages/schedulePage.utils';

export interface UseScheduleEditorReturn {
  localSchedule: Schedule | null;
  editingPreset: PresetKey;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: Error | null;
  showCopyMenu: boolean;
  pendingCopySource: PresetKey | null;
  editingCell: { timeRowIndex: number; saunaIndex: number; entry: Entry | null } | null;
  editingTime: { timeRowIndex: number; currentTime: string } | null;
  eventClock: number;
  livePreset: PresetKey;
  currentDaySchedule: Schedule['presets'][PresetKey] | undefined;
  activeEvent: ReturnType<typeof getActiveEvent>;
  activeEventPreset: PresetKey | undefined;
  scheduleQualityIssues: ReturnType<typeof getScheduleQualityIssues>;
  saunaColors: Record<string, string>;
  draftState: ReturnType<typeof usePersistentEditorDraft<Schedule, { editingPreset: PresetKey }>>;
  unsavedGuard: ReturnType<typeof useUnsavedChangesGuard>;
  setLocalSchedule: React.Dispatch<React.SetStateAction<Schedule | null>>;
  setEditingPreset: React.Dispatch<React.SetStateAction<PresetKey>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCopyMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingCopySource: React.Dispatch<React.SetStateAction<PresetKey | null>>;
  setEditingCell: React.Dispatch<React.SetStateAction<{ timeRowIndex: number; saunaIndex: number; entry: Entry | null } | null>>;
  setEditingTime: React.Dispatch<React.SetStateAction<{ timeRowIndex: number; currentTime: string } | null>>;
  save: ReturnType<typeof useSchedule>['save'];
  refetch: ReturnType<typeof useSchedule>['refetch'];
  schedule: Schedule | null | undefined;
  settings: ReturnType<typeof useSettings>['settings'];
  handlePresetChange: (preset: PresetKey) => void;
  handleSetLivePreset: () => void;
  handleAutoPlayToggle: () => void;
  handleCopyFrom: (sourcePreset: PresetKey) => void;
  confirmCopyFrom: () => void;
  handleEditCell: (timeRowIndex: number, saunaIndex: number) => void;
  handleAddTimeRow: () => void;
  handleEditTime: (timeRowIndex: number) => void;
  handleSaveTime: (newTime: string) => void;
  handleDeleteTimeRow: (timeRowIndex: number) => void;
  handleSaveCell: (entry: Entry | null) => void;
  handleDeleteCell: () => void;
  handleSave: () => void;
  resetToLiveSchedule: () => void;
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
  // Versionskonflikt-State
  conflictInfo: { latestVersion: number | null } | null;
  isForcingSave: boolean;
  setConflictInfo: React.Dispatch<React.SetStateAction<{ latestVersion: number | null } | null>>;
  handleAcceptServer: () => void;
  handleForceSave: () => void;
}

export function useScheduleEditor(): UseScheduleEditorReturn {
  const { user } = useAuth();
  const { schedule, isLoading, error, save, isSaving, refetch } = useSchedule();
  const { settings } = useSettings();

  const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
  const [editingPreset, setEditingPreset] = useState<PresetKey>('Mon');
  const [isDirty, setIsDirty] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [pendingCopySource, setPendingCopySource] = useState<PresetKey | null>(null);
  const [eventClock, setEventClock] = useState(() => Date.now());
  const [editingCell, setEditingCell] = useState<{
    timeRowIndex: number;
    saunaIndex: number;
    entry: Entry | null;
  } | null>(null);
  const [editingTime, setEditingTime] = useState<{
    timeRowIndex: number;
    currentTime: string;
  } | null>(null);

  const draftStorageKey = `htmlsignage_editor_draft_schedule_${user?.id || 'anonymous'}`;

  const draftState = usePersistentEditorDraft<Schedule, { editingPreset: PresetKey }>({
    storageKey: draftStorageKey,
    value: localSchedule,
    meta: { editingPreset },
    isDirty,
    enabled: Boolean(localSchedule),
  });

  const unsavedGuard = useUnsavedChangesGuard({
    when: isDirty,
  });

  if (schedule && !localSchedule && !draftState.hasStoredDraft) {
    setLocalSchedule(schedule);
    setEditingPreset(resolveInitialEditingPreset(schedule, settings));
  }

  useEffect(() => {
    const interval = setInterval(() => {
      // Only trigger a re-render when the actual minute changes — the derived
      // values (livePreset, activeEvent) only care about minutes, not milliseconds.
      setEventClock((prev) => {
        const now = Date.now();
        return Math.floor(now / 60_000) !== Math.floor(prev / 60_000) ? now : prev;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const saunaNamesKey = settings?.saunas?.map((s: Sauna) => s.name).join(',') ?? '';
  const [prevSaunaNamesKey, setPrevSaunaNamesKey] = useState(saunaNamesKey);
  if (prevSaunaNamesKey !== saunaNamesKey && localSchedule && settings?.saunas) {
    setPrevSaunaNamesKey(saunaNamesKey);
    const saunaNames = settings.saunas
      .sort((a: Sauna, b: Sauna) => a.order - b.order)
      .map((s: Sauna) => s.name);

    const currentSaunas = localSchedule.presets[editingPreset]?.saunas || [];
    const saunasChanged =
      currentSaunas.length !== saunaNames.length ||
      currentSaunas.some((name, i) => name !== saunaNames[i]);

    if (saunasChanged) {
      const syncedSchedule = syncScheduleWithSaunas(localSchedule, saunaNames);
      setLocalSchedule(syncedSchedule);
      setIsDirty(true);
    }
  }

  const saunaColors = useMemo(() => {
    const map: Record<string, string> = {};
    if (settings?.saunas) {
      for (const s of settings.saunas) {
        if (s.color) map[s.name] = s.color;
      }
    }
    return map;
  }, [settings]);

  const now = useMemo(() => new Date(eventClock), [eventClock]);
  const livePreset: PresetKey = localSchedule
    ? resolveLivePresetKey(localSchedule, settings, now)
    : getTodayPresetKey(now);

  const currentDaySchedule = localSchedule?.presets?.[editingPreset];
  const activeEvent = settings ? getActiveEvent(settings, now) : null;
  const activeEventPreset = activeEvent?.assignedPreset;
  const scheduleQualityIssues = useMemo(() => getScheduleQualityIssues({
    schedule: localSchedule,
    presetKey: editingPreset,
    settings,
  }), [editingPreset, localSchedule, settings]);

  const handlePresetChange = useCallback((preset: PresetKey) => {
    setEditingPreset(preset);
  }, []);

  const handleSetLivePreset = useCallback(() => {
    if (!localSchedule || localSchedule.autoPlay) return;
    if (localSchedule.activePreset === editingPreset) return;
    const updated = withManualActivePreset(localSchedule, editingPreset);
    setLocalSchedule(updated);
    // Save immediately — user expects "Live schalten" to take effect right away
    const scheduleToSave = withIncrementedScheduleVersion(updated);
    save(scheduleToSave, {
      onSuccess: () => {
        draftState.clearDraft();
        setIsDirty(false);
        // Erfolgs-Toast: differenziert je nachdem, ob ein aktives Event
        // den manuellen Preset gerade noch maskiert. Sonst hat der User
        // den Eindruck, der Klick hat nichts bewirkt — `livePreset` wird
        // weiter vom Event diktiert, bis das Event endet.
        const presetLabel = PRESET_LABELS[editingPreset] ?? editingPreset;
        if (activeEvent) {
          const eventEnd = activeEvent.endTime || '23:59';
          toast.info(
            `${presetLabel} wird live geschaltet, sobald Event „${activeEvent.name}" um ${eventEnd} endet. Aktuell läuft das Event weiter.`,
          );
        } else {
          toast.success(`${presetLabel} ist jetzt live.`);
        }
      },
      onError: (err) => {
        const message = err instanceof Error ? err.message : 'Live-Schalten fehlgeschlagen.';
        toast.error(message);
      },
    });
  }, [localSchedule, editingPreset, save, draftState, activeEvent]);

  const handleAutoPlayToggle = useCallback(() => {
    if (!localSchedule) return;
    setLocalSchedule(withAutoPlayToggled(localSchedule, settings, now));
    setIsDirty(true);
  }, [localSchedule, settings, now]);

  const handleCopyFrom = useCallback((sourcePreset: PresetKey) => {
    if (!localSchedule) return;
    setPendingCopySource(sourcePreset);
    setShowCopyMenu(false);
  }, [localSchedule]);

  const confirmCopyFrom = useCallback(() => {
    if (!localSchedule || !pendingCopySource) return;
    setLocalSchedule(withCopiedPreset(localSchedule, pendingCopySource, editingPreset));
    setIsDirty(true);
    setPendingCopySource(null);
  }, [localSchedule, pendingCopySource, editingPreset]);

  const handleEditCell = useCallback((timeRowIndex: number, saunaIndex: number) => {
    if (!currentDaySchedule) return;
    const entry = currentDaySchedule.rows[timeRowIndex].entries[saunaIndex];
    setEditingCell({ timeRowIndex, saunaIndex, entry });
  }, [currentDaySchedule]);

  const handleAddTimeRow = useCallback(() => {
    if (!localSchedule || !currentDaySchedule) return;
    setEditingTime({ timeRowIndex: -1, currentTime: '12:00' });
  }, [localSchedule, currentDaySchedule]);

  const handleEditTime = useCallback((timeRowIndex: number) => {
    if (!currentDaySchedule) return;
    const currentTime = currentDaySchedule.rows[timeRowIndex].time;
    setEditingTime({ timeRowIndex, currentTime });
  }, [currentDaySchedule]);

  const handleSaveTime = useCallback((newTime: string) => {
    if (!localSchedule || !currentDaySchedule || !editingTime) return;
    if (editingTime.timeRowIndex === -1) {
      setLocalSchedule(withAddedTimeRow(localSchedule, editingPreset, newTime));
    } else {
      setLocalSchedule(withUpdatedTimeRow(localSchedule, editingPreset, editingTime.timeRowIndex, newTime));
    }
    setIsDirty(true);
    setEditingTime(null);
  }, [localSchedule, currentDaySchedule, editingTime, editingPreset]);

  const handleDeleteTimeRow = useCallback((timeRowIndex: number) => {
    if (!localSchedule || !currentDaySchedule) return;
    setLocalSchedule(withDeletedTimeRow(localSchedule, editingPreset, timeRowIndex));
    setIsDirty(true);
  }, [localSchedule, currentDaySchedule, editingPreset]);

  const handleSaveCell = useCallback((entry: Entry | null) => {
    if (!localSchedule || !currentDaySchedule || !editingCell) return;
    setLocalSchedule(
      withCellEntry(
        localSchedule,
        editingPreset,
        editingCell.timeRowIndex,
        editingCell.saunaIndex,
        entry,
      ),
    );
    setIsDirty(true);
    setEditingCell(null);
  }, [localSchedule, currentDaySchedule, editingCell, editingPreset]);

  const handleDeleteCell = useCallback(() => {
    if (!editingCell) return;
    handleSaveCell(null);
  }, [editingCell, handleSaveCell]);

  const [conflictInfo, setConflictInfo] = useState<{ latestVersion: number | null } | null>(null);
  const [isForcingSave, setIsForcingSave] = useState(false);

  const handleSave = useCallback(() => {
    if (!localSchedule) return;
    const scheduleToSave = withIncrementedScheduleVersion(localSchedule);
    save(scheduleToSave, {
      onSuccess: () => {
        draftState.clearDraft();
        setIsDirty(false);
        // invalidateQueries in the mutation's onSuccess already triggers a refetch
      },
      onError: (err) => {
        const conflict = extractVersionConflict(err);
        if (conflict) {
          setConflictInfo({ latestVersion: conflict.latestVersion });
        }
        // Andere Fehler werden bereits vom Mutation-Hook getoastet.
      },
    });
  }, [localSchedule, save, draftState]);

  const handleAcceptServer = useCallback(() => {
    setConflictInfo(null);
    draftState.clearDraft();
    setIsDirty(false);
    if (schedule) setLocalSchedule(schedule);
    refetch();
    toast.info('Server-Stand übernommen. Lokale Änderungen wurden verworfen.');
  }, [schedule, refetch, draftState]);

  const handleForceSave = useCallback(() => {
    if (!localSchedule || !conflictInfo?.latestVersion) return;
    setIsForcingSave(true);
    const forced: Schedule = {
      ...localSchedule,
      version: conflictInfo.latestVersion + 1,
    };
    save(forced, {
      onSuccess: () => {
        setIsForcingSave(false);
        setConflictInfo(null);
        draftState.clearDraft();
        setIsDirty(false);
        setLocalSchedule((prev) => (prev ? { ...prev, version: forced.version } : prev));
        toast.success(`Aufgussplan erzwungen gespeichert (v${forced.version}).`);
      },
      onError: (err) => {
        setIsForcingSave(false);
        const conflict = extractVersionConflict(err);
        if (conflict) {
          setConflictInfo({ latestVersion: conflict.latestVersion });
          toast.warning('Während des Erzwingens hat jemand erneut gespeichert.');
          return;
        }
        toast.error(err instanceof Error ? err.message : 'Erzwingen fehlgeschlagen.');
      },
    });
  }, [localSchedule, conflictInfo, save, draftState]);

  const resetToLiveSchedule = useCallback(() => {
    if (!schedule) return;
    setLocalSchedule(schedule);
    setEditingPreset(resolveInitialEditingPreset(schedule, settings));
    setIsDirty(false);
  }, [schedule, settings]);

  const handleRestoreDraft = useCallback(() => {
    const restored = draftState.restoreDraft();
    if (!restored) return;
    setLocalSchedule(restored.value);
    setEditingPreset(restored.meta?.editingPreset || getTodayPresetKey());
    setIsDirty(true);
  }, [draftState]);

  const handleDiscardDraft = useCallback(() => {
    draftState.clearDraft();
    resetToLiveSchedule();
  }, [draftState, resetToLiveSchedule]);

  return {
    localSchedule,
    editingPreset,
    isDirty,
    isSaving,
    isLoading,
    error,
    showCopyMenu,
    pendingCopySource,
    editingCell,
    editingTime,
    eventClock,
    livePreset,
    currentDaySchedule,
    activeEvent,
    activeEventPreset,
    scheduleQualityIssues,
    saunaColors,
    draftState,
    unsavedGuard,
    setLocalSchedule,
    setEditingPreset,
    setIsDirty,
    setShowCopyMenu,
    setPendingCopySource,
    setEditingCell,
    setEditingTime,
    save,
    refetch,
    schedule,
    settings,
    handlePresetChange,
    handleSetLivePreset,
    handleAutoPlayToggle,
    handleCopyFrom,
    confirmCopyFrom,
    handleEditCell,
    handleAddTimeRow,
    handleEditTime,
    handleSaveTime,
    handleDeleteTimeRow,
    handleSaveCell,
    handleDeleteCell,
    handleSave,
    resetToLiveSchedule,
    handleRestoreDraft,
    handleDiscardDraft,
    conflictInfo,
    isForcingSave,
    setConflictInfo,
    handleAcceptServer,
    handleForceSave,
  };
}
