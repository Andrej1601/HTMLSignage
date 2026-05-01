import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedia, useDeleteMedia, useMediaTags, useUpdateMediaTags } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import { useMediaUsage, getUsageSummary } from '@/hooks/useMediaUsage';
import { mediaApi } from '@/services/api';
import { toast } from '@/stores/toastStore';
import { useQueryClient } from '@tanstack/react-query';
import type { Media, MediaType } from '@/types/media.types';

type ViewMode = 'grid' | 'list';

export function normalizeTagsInput(value: string): string[] {
  const unique = new Set<string>();
  for (const rawTag of value.split(',')) {
    const tag = rawTag.trim();
    if (!tag) continue;
    if (tag.length > 32) continue;
    unique.add(tag);
    if (unique.size >= 20) break;
  }
  return [...unique];
}

export function hasTagCaseInsensitive(tags: string[], tag: string): boolean {
  return tags.some((entry) => entry.localeCompare(tag, 'de', { sensitivity: 'accent' }) === 0);
}

export function useMediaPageState() {
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [taggingMedia, setTaggingMedia] = useState<Media | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagDraft, setBulkTagDraft] = useState('');
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'replace'>('add');
  const [bulkTagSaving, setBulkTagSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  const filter = useMemo(() => ({
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: debouncedSearchQuery || undefined,
    tag: tagFilter === 'all' ? undefined : tagFilter,
  }), [typeFilter, debouncedSearchQuery, tagFilter]);

  const { data: media = [], isLoading, isFetching, error, refetch } = useMedia(filter);
  const { data: availableTags = [] } = useMediaTags();
  const deleteMedia = useDeleteMedia();
  const updateMediaTags = useUpdateMediaTags();
  const { settings } = useSettings();
  const mediaUsageMap = useMediaUsage(settings);

  const mediaUsageSummaries = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [id, usage] of mediaUsageMap) {
      const summary = getUsageSummary(usage);
      if (summary.length > 0) map.set(id, summary);
    }
    return map;
  }, [mediaUsageMap]);

  const openTagEditor = useCallback((item: Media) => {
    setTaggingMedia(item);
    setTagDraft((item.tags || []).join(', '));
  }, []);

  const closeTagEditor = useCallback(() => {
    setTaggingMedia(null);
    setTagDraft('');
  }, []);

  const parsedTagDraft = useMemo(() => normalizeTagsInput(tagDraft), [tagDraft]);

  const toggleExistingTag = (tag: string) => {
    const currentTags = normalizeTagsInput(tagDraft);
    const nextTags = hasTagCaseInsensitive(currentTags, tag)
      ? currentTags.filter((entry) => entry.localeCompare(tag, 'de', { sensitivity: 'accent' }) !== 0)
      : [...currentTags, tag];
    setTagDraft(nextTags.join(', '));
  };

  const handleSaveTags = () => {
    if (!taggingMedia) return;
    updateMediaTags.mutate(
      { id: taggingMedia.id, tags: parsedTagDraft },
      { onSuccess: () => closeTagEditor() },
    );
  };

  const handleDeleteMedia = () => {
    if (!deletingMedia) return;
    deleteMedia.mutate(deletingMedia.id, {
      onSuccess: () => {
        setDeletingMedia(null);
      },
    });
  };

  // ─── Bulk-Selection ────────────────────────────────────────────────────
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAllVisible = useCallback((items: Media[]) => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, []);

  // Falls die gefilterte Medienliste schrumpft (z. B. Filter ändert sich),
  // räumen wir IDs aus der Auswahl, die nicht mehr sichtbar sind. So
  // klickt der User nicht versehentlich ausgeblendete Elemente weg.
  // Render-phase: tracked Vorgängerwert von `media` triggert den Sync
  // exakt einmal pro Wechsel (kein setState-in-effect).
  const [prevMedia, setPrevMedia] = useState(media);
  if (media !== prevMedia) {
    setPrevMedia(media);
    if (selectedIds.size > 0) {
      const visibleIds = new Set(media.map((item) => item.id));
      const filtered = new Set<string>();
      for (const id of selectedIds) if (visibleIds.has(id)) filtered.add(id);
      if (filtered.size !== selectedIds.size) setSelectedIds(filtered);
    }
  }

  const selectedMedia = useMemo(
    () => media.filter((item) => selectedIds.has(item.id)),
    [media, selectedIds],
  );

  const handleBulkDeleteRequest = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => mediaApi.deleteMedia(id)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    queryClient.invalidateQueries({ queryKey: ['media'] });
    queryClient.invalidateQueries({ queryKey: ['media-tags'] });

    if (failed === 0) {
      toast.success(`${succeeded} Datei${succeeded === 1 ? '' : 'en'} gelöscht.`);
    } else if (succeeded === 0) {
      toast.error(`Löschen fehlgeschlagen für ${failed} Datei${failed === 1 ? '' : 'en'}.`);
    } else {
      toast.warning(`${succeeded} gelöscht, ${failed} fehlgeschlagen.`);
    }

    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
  };

  // ─── Bulk-Tag ──────────────────────────────────────────────────────────
  const openBulkTagEditor = () => {
    if (selectedIds.size === 0) return;
    setBulkTagDraft('');
    setBulkTagMode('add');
    setBulkTagging(true);
  };

  const closeBulkTagEditor = () => {
    setBulkTagging(false);
    setBulkTagDraft('');
  };

  const parsedBulkTagDraft = useMemo(() => normalizeTagsInput(bulkTagDraft), [bulkTagDraft]);

  const handleSaveBulkTags = async () => {
    if (selectedIds.size === 0) return;
    if (bulkTagMode === 'add' && parsedBulkTagDraft.length === 0) {
      toast.warning('Mindestens ein Tag eingeben.');
      return;
    }
    setBulkTagSaving(true);

    const updates = selectedMedia.map((item) => {
      let nextTags: string[];
      if (bulkTagMode === 'replace') {
        nextTags = parsedBulkTagDraft;
      } else {
        // Add-Mode: bestehende Tags beibehalten und neue hinzufügen,
        // Duplikate (case-insensitive) ignorieren.
        const merged = [...(item.tags || [])];
        for (const tag of parsedBulkTagDraft) {
          if (!hasTagCaseInsensitive(merged, tag)) merged.push(tag);
        }
        nextTags = merged.slice(0, 20);
      }
      return mediaApi.updateMediaTags(item.id, nextTags);
    });

    const results = await Promise.allSettled(updates);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    queryClient.invalidateQueries({ queryKey: ['media'] });
    queryClient.invalidateQueries({ queryKey: ['media-tags'] });

    if (failed === 0) {
      toast.success(`Tags für ${succeeded} Datei${succeeded === 1 ? '' : 'en'} aktualisiert.`);
    } else if (succeeded === 0) {
      toast.error(`Tag-Update fehlgeschlagen für ${failed} Datei${failed === 1 ? '' : 'en'}.`);
    } else {
      toast.warning(`${succeeded} aktualisiert, ${failed} fehlgeschlagen.`);
    }

    setBulkTagSaving(false);
    setBulkTagging(false);
    setBulkTagDraft('');
  };

  const stats = {
    total: media.length,
    images: media.filter((m) => m.type === 'image').length,
    audio: media.filter((m) => m.type === 'audio').length,
    video: media.filter((m) => m.type === 'video').length,
    totalSize: media.reduce((sum, m) => sum + (m.size || 0), 0),
  };

  const activeTypeFilter =
    typeFilter === 'all'
      ? 'Alle Typen'
      : typeFilter === 'image'
        ? 'Bilder'
        : typeFilter === 'audio'
          ? 'Audio'
          : 'Video';

  const trimmedSearch = searchQuery.trim();
  const hasActiveTagFilter = tagFilter !== 'all';

  return {
    // Filters
    typeFilter, setTypeFilter,
    tagFilter, setTagFilter,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    // Data
    media, isLoading, isFetching, error, refetch,
    availableTags,
    mediaUsageSummaries,
    stats,
    activeTypeFilter,
    trimmedSearch,
    hasActiveTagFilter,
    // Upload
    uploadOpen, setUploadOpen,
    // Delete
    deletingMedia, setDeletingMedia,
    handleDeleteMedia,
    deleteMedia,
    // Tag editing
    taggingMedia,
    tagDraft, setTagDraft,
    parsedTagDraft,
    openTagEditor,
    closeTagEditor,
    toggleExistingTag,
    handleSaveTags,
    updateMediaTags,
    // Bulk-Selection
    selectedIds,
    selectedMedia,
    toggleSelected,
    clearSelection,
    selectAllVisible,
    // Bulk-Delete
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkDeleting,
    handleBulkDeleteRequest,
    handleBulkDeleteConfirm,
    // Bulk-Tag
    bulkTagging,
    openBulkTagEditor,
    closeBulkTagEditor,
    bulkTagDraft,
    setBulkTagDraft,
    bulkTagMode,
    setBulkTagMode,
    parsedBulkTagDraft,
    bulkTagSaving,
    handleSaveBulkTags,
  };
}
