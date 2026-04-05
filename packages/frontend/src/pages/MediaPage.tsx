import { Layout } from '@/components/Layout';
import { SkeletonMediaCard } from '@/components/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { MediaUpload } from '@/components/Media/MediaUpload';
import { MediaGrid } from '@/components/Media/MediaGrid';
import type { Media, MediaType } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { ImageIcon, RefreshCw, Upload, Music, Film, LayoutGrid, List, Trash2, Tags, Edit3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useMediaMetadata } from '@/hooks/useMediaMetadata';
import { ComboboxField } from '@/components/ComboboxField';
import { useMediaPageState, normalizeTagsInput, hasTagCaseInsensitive } from '@/hooks/useMediaPageState';

export function MediaPage() {
  const state = useMediaPageState();
  const {
    typeFilter, setTypeFilter,
    tagFilter, setTagFilter,
    searchQuery, setSearchQuery,
    viewMode, setViewMode,
    media, isLoading, isFetching, error, refetch,
    availableTags,
    mediaUsageSummaries,
    stats,
    uploadOpen, setUploadOpen,
    deletingMedia, setDeletingMedia,
    handleDeleteMedia,
    deleteMedia,
    taggingMedia,
    tagDraft, setTagDraft,
    parsedTagDraft,
    openTagEditor,
    closeTagEditor,
    toggleExistingTag,
    handleSaveTags,
    updateMediaTags,
  } = state;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
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
                Medien hochladen
              </Button>
            </>
          )}
          badges={[
            { label: `${stats.total} Dateien`, tone: 'info' },
            { label: formatFileSize(stats.totalSize), tone: 'info' },
          ]}
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Gesamt" value={stats.total} icon={ImageIcon} color="primary" />
          <StatCard title="Bilder" value={stats.images} icon={ImageIcon} color="info" />
          <StatCard title="Audio" value={stats.audio} icon={Music} color="violet" />
          <StatCard title="Video" value={stats.video} icon={Film} color="success" />
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Medien durchsuchen..."
              className="w-full rounded-lg border border-spa-bg-secondary bg-white py-2 pl-4 pr-3 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MediaType | 'all')}
            className="rounded-lg border border-spa-bg-secondary bg-white px-3 py-2 text-sm text-spa-text-primary outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
          >
            <option value="all">Alle Typen</option>
            <option value="image">Bilder</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-spa-bg-secondary bg-white px-3 py-2 text-sm text-spa-text-primary outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
          >
            <option value="all">Alle Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-spa-bg-secondary bg-white p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md p-2 transition-colors ${viewMode === 'grid' ? 'bg-spa-primary text-white' : 'text-spa-text-secondary hover:bg-spa-bg-primary'}`}
              aria-label="Rasteransicht"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md p-2 transition-colors ${viewMode === 'list' ? 'bg-spa-primary text-white' : 'text-spa-text-secondary hover:bg-spa-bg-primary'}`}
              aria-label="Listenansicht"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          {isFetching && (
            <span className="text-xs text-spa-text-secondary">Aktualisiert...</span>
          )}
        </div>

        {/* Upload Drop Zone */}
        {uploadOpen && (
          <MediaUpload onUploadComplete={() => refetch()} />
        )}

        {/* Media Grid / List */}
        {isLoading && media.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }, (_, i) => <SkeletonMediaCard key={i} />)}
          </div>
        ) : error ? (
          <ErrorAlert error={error} onRetry={() => refetch()} />
        ) : viewMode === 'grid' ? (
          <MediaGrid
            media={media}
            onDelete={setDeletingMedia}
            onEditTags={openTagEditor}
            mediaUsage={mediaUsageSummaries}
          />
        ) : (
          <MediaListView
            media={media}
            onDelete={setDeletingMedia}
            onEditTags={openTagEditor}
          />
        )}

        {/* Single Delete Confirm */}
        <ConfirmDialog
          isOpen={Boolean(deletingMedia)}
          title="Datei löschen?"
          message={(() => {
            const base = `Möchtest du die Datei "${deletingMedia?.originalName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
            const usage = deletingMedia ? mediaUsageSummaries.get(deletingMedia.id) : undefined;
            if (usage && usage.length > 0) {
              return `${base}\n\n⚠️ Diese Datei wird verwendet in: ${usage.join(', ')}. Das Löschen kann zu fehlenden Inhalten führen.`;
            }
            return base;
          })()}
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
            <ComboboxField
              label="Tag hinzufügen"
              value=""
              onChange={(val) => {
                if (!val.trim()) return;
                const currentTags = normalizeTagsInput(tagDraft);
                if (!hasTagCaseInsensitive(currentTags, val.trim())) {
                  setTagDraft([...currentTags, val.trim()].join(', '));
                }
              }}
              options={availableTags.filter((tag) => !hasTagCaseInsensitive(parsedTagDraft, tag))}
              placeholder="Tag eingeben oder auswählen..."
              createLabel="Neues Tag"
            />
            <p className="text-xs text-spa-text-secondary -mt-2">
              Maximal 20 Tags, je 32 Zeichen. Vorhandene Tags oder neue erstellen.
            </p>
            {parsedTagDraft.length > 0 && (
              <div>
                <p className="text-sm font-medium text-spa-text-primary mb-2">Aktive Tags</p>
                <div className="flex flex-wrap gap-2">
                  {parsedTagDraft.map((tag) => (
                    <button
                      key={`active-tag-${tag}`}
                      type="button"
                      onClick={() => toggleExistingTag(tag)}
                      className="rounded-full px-3 py-1 text-xs border transition-colors bg-spa-primary text-white border-spa-primary hover:bg-spa-primary/80"
                      title="Klicken zum Entfernen"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
            {parsedTagDraft.length === 0 && (
              <p className="text-sm text-spa-text-secondary">Keine Tags gesetzt. Nutze das Feld oben um Tags hinzuzufügen.</p>
            )}
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
      <EmptyState
        icon={ImageIcon}
        title="Keine Medien gefunden"
        description="Lade deine ersten Dateien hoch, um loszulegen"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-spa-bg-secondary bg-white overflow-hidden divide-y divide-spa-bg-secondary">
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
      <div className="w-12 h-12 rounded-lg bg-spa-bg-primary overflow-hidden shrink-0">
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
          {formatFileSize(item.size)}
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
