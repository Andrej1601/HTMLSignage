import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/toastStore';
import { useDevices } from '@/hooks/useDevices';
import { useSlideshows, useUpdateSlideshow, useCreateSlideshow, useDeleteSlideshow } from '@/hooks/useSlideshows';
import { useSchedule } from '@/hooks/useSchedule';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import { createDefaultSchedule } from '@/types/schedule.types';
import type { SlideshowConfig, SlideshowDefinition } from '@/types/slideshow.types';
import { createDefaultSlideshowConfig } from '@/types/slideshow.types';
import { getActiveEvent } from '@/types/settings.types';
import { getSlideshowQualityIssues } from '@/utils/editorQuality';
import {
  buildSlideshowPreviewPayload,
  normalizeEditorConfig,
  normalizePrestartMinutes,
} from '@/pages/slideshowPage.utils';

type ConfirmAction =
  | { type: 'switch-slideshow'; nextSlideshowId: string }
  | { type: 'reset' }
  | { type: 'delete-slideshow'; slideshow: SlideshowDefinition }
  | null;

export function useSlideshowEditor() {
  const { settings, isLoading: settingsLoading, error: settingsError, refetch } = useSettings();
  const { schedule } = useSchedule();
  const { data: media = [] } = useMedia();
  const { data: devices = [] } = useDevices();
  const { data: slideshows = [], isLoading: slideshowsLoading } = useSlideshows();
  const updateSlideshow = useUpdateSlideshow();
  const createSlideshow = useCreateSlideshow();
  const deleteSlideshow = useDeleteSlideshow();

  const pairedDevices = useMemo(
    () => devices.filter((device) => Boolean(device.pairedAt)),
    [devices],
  );

  // Slideshow selection: explicit user pick (null = derive default from list).
  const [searchParams, setSearchParams] = useSearchParams();
  const [explicitSelection, setExplicitSelection] = useState<string | null>(() => {
    return searchParams.get('slideshow') || null;
  });

  // Effective ID is either the user's pick (if it still exists) or the default.
  // Derived state — no setState-in-effect, so the list automatically self-heals
  // when a slideshow is deleted out from under the current selection.
  const selectedSlideshowId = useMemo<string | null>(() => {
    if (slideshows.length === 0) return null;
    if (explicitSelection && slideshows.some((s) => s.id === explicitSelection)) {
      return explicitSelection;
    }
    return slideshows.find((s) => s.isDefault)?.id || slideshows[0].id;
  }, [explicitSelection, slideshows]);

  // Clear ?slideshow= from URL after consuming it
  useEffect(() => {
    if (searchParams.has('slideshow')) {
      setSearchParams((prev) => { prev.delete('slideshow'); return prev; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const selectedSlideshow = useMemo(
    () => slideshows.find((s) => s.id === selectedSlideshowId) || null,
    [slideshows, selectedSlideshowId],
  );

  // Editor state
  const [editorConfig, setEditorConfig] = useState<SlideshowConfig | null>(null);
  const [editorPrestartMinutes, setEditorPrestartMinutes] = useState(10);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const previewSchedule = schedule || createDefaultSchedule();
  const activeEvent = useMemo(() => (settings ? getActiveEvent(settings, new Date()) : null), [settings]);

  // Load editor config from selected slideshow
  const loadEditorFromSlideshow = useCallback((slideshow: SlideshowDefinition | null) => {
    if (!slideshow) return;
    const config = slideshow.config || createDefaultSlideshowConfig();
    setEditorConfig(normalizeEditorConfig(config, createDefaultSlideshowConfig()));
    setEditorPrestartMinutes(normalizePrestartMinutes(
      settings?.display?.prestartMinutes,
      10,
    ));
    setIsDirty(false);
  }, [settings]);

  // Auto-load when slideshow selection changes (skip if user has unsaved edits).
  // This is a deliberate "sync editor draft to source of truth" effect — the editor
  // owns mutable draft state that must reset when the user picks a different slideshow.
  // Can't be derived state because the user actively edits between resets.
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedSlideshow || isDirty) return;
    if (selectedSlideshow.id === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = selectedSlideshow.id;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional draft sync; see comment above
    loadEditorFromSlideshow(selectedSlideshow);
  }, [selectedSlideshow, isDirty, loadEditorFromSlideshow]);

  // Preview payload
  const previewPayload = useMemo(() => {
    return buildSlideshowPreviewPayload({
      settings,
      previewSchedule,
      editorConfig,
      editorPrestartMinutes,
      isDirty,
    });
  }, [editorConfig, editorPrestartMinutes, isDirty, previewSchedule, settings]);

  // Quality checks
  const slideshowQualityIssues = useMemo(() => getSlideshowQualityIssues({
    config: editorConfig,
    settings: previewPayload?.settings || settings,
    media,
    audioOverride: null,
  }), [editorConfig, media, previewPayload?.settings, settings]);

  // Flags
  const isLoading = settingsLoading || slideshowsLoading;
  const error = settingsError;
  const isBusy = updateSlideshow.isPending || createSlideshow.isPending || deleteSlideshow.isPending;

  // ── Handlers ──

  const handleSelectSlideshow = (nextId: string) => {
    if (nextId === selectedSlideshowId) return;
    if (isDirty) {
      setConfirmAction({ type: 'switch-slideshow', nextSlideshowId: nextId });
      return;
    }
    setExplicitSelection(nextId);
    setIsDirty(false);
  };

  const handleReloadCurrent = () => {
    if (isDirty) {
      setConfirmAction({ type: 'reset' });
      return;
    }
    loadEditorFromSlideshow(selectedSlideshow);
  };

  const handleConfirmAction = useCallback(() => {
    if (!confirmAction) return;

    if (confirmAction.type === 'switch-slideshow') {
      setExplicitSelection(confirmAction.nextSlideshowId);
      setIsDirty(false);
    } else if (confirmAction.type === 'reset') {
      loadEditorFromSlideshow(selectedSlideshow);
    } else if (confirmAction.type === 'delete-slideshow') {
      deleteSlideshow.mutate(confirmAction.slideshow.id, {
        onSuccess: () => {
          // Select default slideshow after deletion
          const remaining = slideshows.filter((s) => s.id !== confirmAction.slideshow.id);
          const next = remaining.find((s) => s.isDefault) || remaining[0];
          if (next) setExplicitSelection(next.id);
        },
      });
    }

    setConfirmAction(null);
  }, [confirmAction, deleteSlideshow, loadEditorFromSlideshow, selectedSlideshow, slideshows]);

  const handleSaveCurrent = () => {
    if (!editorConfig || !selectedSlideshowId) return;
    const name = selectedSlideshow?.name ?? 'Slideshow';
    updateSlideshow.mutate(
      {
        id: selectedSlideshowId,
        updates: { config: editorConfig },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          void refetch();
          toast.success(`„${name}" gespeichert.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
        },
      },
    );
  };

  const handleCreateSlideshow = (name: string, copyFromId?: string) => {
    createSlideshow.mutate(
      { name, copyFromId },
      {
        onSuccess: (created) => {
          setExplicitSelection(created.id);
          setIsDirty(false);
          toast.success(`Slideshow „${created.name}" angelegt.`);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Erstellen fehlgeschlagen.');
        },
      },
    );
  };

  const handleDeleteSlideshow = (slideshow: SlideshowDefinition) => {
    if (slideshow.isDefault) return; // Can't delete default
    setConfirmAction({ type: 'delete-slideshow', slideshow });
  };

  const handleRenameSlideshow = (id: string, name: string) => {
    updateSlideshow.mutate({ id, updates: { name } });
  };

  const handleConfigChange = (nextConfig: SlideshowConfig) => {
    setEditorConfig(nextConfig);
    setIsDirty(true);
  };

  const handlePrestartMinutesChange = (minutes: number) => {
    setEditorPrestartMinutes(normalizePrestartMinutes(minutes, editorPrestartMinutes));
    setIsDirty(true);
  };

  return {
    // Data
    settings,
    schedule,
    isLoading,
    error,
    refetch,
    slideshows,
    selectedSlideshow,
    selectedSlideshowId,
    pairedDevices,
    activeEvent,
    previewPayload,
    slideshowQualityIssues,

    // Editor state
    editorConfig,
    editorPrestartMinutes,
    isDirty,
    confirmAction,

    // Derived flags
    isBusy,

    // Mutation states
    updateSlideshow,
    createSlideshow,
    deleteSlideshow,

    // Handlers
    handleSelectSlideshow,
    handleReloadCurrent,
    handleConfirmAction,
    handleSaveCurrent,
    handleCreateSlideshow,
    handleDeleteSlideshow,
    handleRenameSlideshow,
    handleConfigChange,
    handlePrestartMinutesChange,
    setConfirmAction,
  };
}
