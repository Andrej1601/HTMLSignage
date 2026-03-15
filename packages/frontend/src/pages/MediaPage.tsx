import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { MediaUpload } from '@/components/Media/MediaUpload';
import { MediaGrid } from '@/components/Media/MediaGrid';
import { useMedia, useDeleteMedia, useMediaTags, useUpdateMediaTags } from '@/hooks/useMedia';
import type { Media, MediaType } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { StatCard } from '@/components/Dashboard/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { InputField } from '@/components/FormField';
import { ImageIcon, RefreshCw, Upload, Filter, Music, Film, LayoutGrid, List, Trash2, Tags, Edit3 } from 'lucide-react';
import { Button } from '@/components/Button';
import { ErrorAlert } from '@/components/ErrorAlert';
import { SectionCard } from '@/components/SectionCard';
import { useMediaMetadata } from '@/hooks/useMediaMetadata';

type ViewMode = 'grid' | 'list';

function normalizeTagsInput(value: string): string[] {
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

function hasTagCaseInsensitive(tags: string[], tag: string): boolean {
  return tags.some((entry) => entry.localeCompare(tag, 'de', { sensitivity: 'accent' }) === 0);
}

export function MediaPage() {
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

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Medien-Bibliothek"
          description="Verwalte Bilder, Audio und Video für die Ausspielung."
          icon={ImageIcon}
          actions={(
            <>
              <Button variant="secondary" icon={RefreshCw} onClick={() => refetch()}>
                Aktualisieren
              </Button>
              <Button icon={Upload} onClick={() => setUploadOpen(!uploadOpen)}>
                {uploadOpen ? 'Upload schließen' : 'Hochladen'}
              </Button>
            </>
          )}
          badges={[
            { label: `${stats.total} Dateien`, tone: 'info' },
            { label: `Filter: ${activeTypeFilter}`, tone: typeFilter === 'all' ? 'neutral' : 'info' },
            { label: trimmedSearch ? `Suche: ${trimmedSearch}` : 'Keine Suche', tone: trimmedSearch ? 'warning' : 'neutral' },
            { label: hasActiveTagFilter ? `Tag: ${tagFilter}` : 'Alle Tags', tone: hasActiveTagFilter ? 'info' : 'neutral' },
          ]}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Gesamt" value={stats.total} icon={ImageIcon} color="primary" />
          <StatCard title="Bilder" value={stats.images} icon={ImageIcon} color="info" />
          <StatCard title="Audio" value={stats.audio} icon={Music} color="violet" />
          <StatCard title="Video" value={stats.video} icon={Film} color="success" />
        </div>

        {/* Upload Section */}
        {uploadOpen && (
          <MediaUpload onUploadComplete={() => refetch()} />
        )}

        {/* Filters + View Toggle */}
        <SectionCard title="Filter & Ansicht" icon={Filter}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MediaType | 'all')}
                className="px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              >
                <option value="all">Alle Typen</option>
                <option value="image">Bilder</option>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </div>

            {/* Tag Filter */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Tags className="w-5 h-5 text-spa-text-secondary" />
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
              >
                <option value="all">Alle Tags</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Dateinamen suchen..."
              className="flex-1 px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
            />

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border border-spa-bg-secondary rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-spa-primary text-white' : 'text-spa-text-secondary hover:bg-spa-bg-primary'}`}
                aria-label="Rasteransicht"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-spa-primary text-white' : 'text-spa-text-secondary hover:bg-spa-bg-primary'}`}
                aria-label="Listenansicht"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          {isFetching && (
            <p className="mt-2 text-xs text-spa-text-secondary">Filter wird aktualisiert...</p>
          )}
        </SectionCard>

        {/* Media Grid or List */}
        <SectionCard title="Dateien" icon={ImageIcon} noPadding>
          {isLoading && media.length === 0 ? (
            <div className="p-6">
              <LoadingSpinner label="Lade Medien..." />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorAlert error={error} onRetry={() => refetch()} />
            </div>
          ) : viewMode === 'grid' ? (
            <div className="p-6">
              <MediaGrid
                media={media}
                onDelete={setDeletingMedia}
                onEditTags={openTagEditor}
              />
            </div>
          ) : (
            <MediaListView
              media={media}
              onDelete={setDeletingMedia}
              onEditTags={openTagEditor}
            />
          )}
        </SectionCard>

        {/* Single Delete Confirm */}
        <ConfirmDialog
          isOpen={Boolean(deletingMedia)}
          title="Datei löschen?"
          message={`Möchtest du die Datei "${deletingMedia?.originalName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel={deleteMedia.isPending ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={handleDeleteMedia}
          onCancel={() => setDeletingMedia(null)}
        />

        {/* Edit tags */}
        <Dialog
          isOpen={Boolean(taggingMedia)}
          onClose={closeTagEditor}
          title={taggingMedia ? `Tags bearbeiten: ${taggingMedia.originalName}` : 'Tags bearbeiten'}
          size="md"
          closeDisabled={updateMediaTags.isPending}
          footer={(
            <>
              <Button
                variant="ghost"
                onClick={closeTagEditor}
                disabled={updateMediaTags.isPending}
              >
                Abbrechen
              </Button>
              <Button
                icon={Tags}
                onClick={handleSaveTags}
                loading={updateMediaTags.isPending}
                loadingText="Speichert..."
              >
                Speichern
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <InputField
              label="Tags"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="z. B. Werbung, Event, Aufguss, Partner"
              hint="Kommagetrennt eingeben. Maximal 20 Tags, je 32 Zeichen."
            />
            {availableTags.length > 0 && (
              <div>
                <p className="text-sm font-medium text-spa-text-primary mb-2">Vorhandene Tags</p>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = hasTagCaseInsensitive(parsedTagDraft, tag);
                    return (
                      <button
                        key={`existing-tag-${tag}`}
                        type="button"
                        onClick={() => toggleExistingTag(tag)}
                        className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                          isSelected
                            ? 'bg-spa-primary text-white border-spa-primary'
                            : 'bg-spa-secondary/10 text-spa-text-primary border-spa-secondary/30 hover:bg-spa-secondary/20'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-spa-text-secondary mt-2">
                  Tipp: Mit Klick übernimmst oder entfernst du ein bestehendes Tag.
                </p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-spa-text-primary mb-2">Vorschau</p>
              {parsedTagDraft.length === 0 ? (
                <p className="text-sm text-spa-text-secondary">Keine Tags gesetzt.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {parsedTagDraft.map((tag) => (
                    <span
                      key={`draft-${tag}`}
                      className="inline-flex items-center rounded-full bg-spa-secondary/15 px-2.5 py-1 text-xs text-spa-text-primary"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Dialog>
      </div>
    </Layout>
  );
}

// List View Component
function MediaListView({
  media,
  onDelete,
  onEditTags,
}: {
  media: Media[];
  onDelete: (media: Media) => void;
  onEditTags: (media: Media) => void;
}) {
  if (media.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <ImageIcon className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
          Keine Medien gefunden
        </h3>
        <p className="text-spa-text-secondary">
          Lade deine ersten Dateien hoch, um loszulegen
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden divide-y divide-spa-bg-secondary">
      {media.map((item) => (
        <MediaListRow
          key={item.id}
          item={item}
          onDelete={onDelete}
          onEditTags={onEditTags}
        />
      ))}
    </div>
  );
}

function MediaListRow({
  item,
  onDelete,
  onEditTags,
}: {
  item: Media;
  onDelete: (media: Media) => void;
  onEditTags: (media: Media) => void;
}) {
  const mediaUrl = toAbsoluteMediaUrl(item.url);
  const { summary } = useMediaMetadata(mediaUrl, item.type);

  return (
    <div className="flex items-center gap-4 p-3 hover:bg-spa-bg-primary transition-colors">
      <div className="w-12 h-12 rounded-lg bg-spa-bg-primary overflow-hidden flex-shrink-0">
        {item.type === 'image' ? (
          <img
            src={mediaUrl}
            alt={item.originalName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.type === 'audio' ? (
              <Music className="w-5 h-5 text-spa-primary/40" />
            ) : (
              <Film className="w-5 h-5 text-spa-primary/40" />
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-spa-text-primary truncate">{item.originalName}</p>
        <p className="text-xs text-spa-text-secondary">
          {item.type} &middot; {formatFileSize(item.size)}
          {summary ? ` · ${summary}` : ''}
        </p>
        {item.tags && item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.slice(0, 5).map((tag) => (
              <span
                key={`${item.id}-list-${tag}`}
                className="inline-flex items-center rounded-full bg-spa-secondary/15 px-2 py-0.5 text-[11px] text-spa-text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <span className="text-xs text-spa-text-secondary hidden sm:block">
        {new Date(item.createdAt).toLocaleDateString('de-DE')}
      </span>

      <Button
        variant="secondary"
        size="sm"
        icon={Edit3}
        onClick={() => onEditTags(item)}
        aria-label={`${item.originalName} Tags bearbeiten`}
      />
      <Button
        variant="danger"
        size="sm"
        icon={Trash2}
        onClick={() => onDelete(item)}
        aria-label={`${item.originalName} löschen`}
      />
    </div>
  );
}
