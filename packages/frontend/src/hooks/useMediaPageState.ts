import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMedia, useDeleteMedia, useMediaTags, useUpdateMediaTags } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import { useMediaUsage, getUsageSummary } from '@/hooks/useMediaUsage';
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
  };
}
