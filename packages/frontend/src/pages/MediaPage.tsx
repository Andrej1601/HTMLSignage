import { useEffect } from 'react';
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
import { ImageIcon, RefreshCw, Upload, Music, Film, LayoutGrid, List, Trash2, Tags, Edit3, X, CheckSquare } from 'lucide-react';
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
    // Bulk
    selectedIds,
    toggleSelected,
    clearSelection,
    selectAllVisible,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkDeleting,
    handleBulkDeleteRequest,
    handleBulkDeleteConfirm,
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
  } = state;

  // Quick-Action-Hook: Command-Palette navigiert mit `#upload` hierher.
  useEffect(() => {
    if (window.location.hash === '#upload') {
      setUploadOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [setUploadOpen]);

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
              className="w-full rounded-lg border border-spa-bg-secondary bg-spa-surface py-2 pl-4 pr-3 text-sm text-spa-text-primary placeholder:text-spa-text-secondary/60 outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MediaType | 'all')}
            className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-sm text-spa-text-primary outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
          >
            <option value="all">Alle Typen</option>
            <option value="image">Bilder</option>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
          </select>

          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-spa-bg-secondary bg-spa-surface px-3 py-2 text-sm text-spa-text-primary outline-hidden focus:border-spa-primary focus:ring-2 focus:ring-spa-primary/20"
          >
            <option value="all">Alle Tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-lg border border-spa-bg-secondary bg-spa-surface p-1">
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
            {Array.from({ length: 8 }, (_, i) => <SkeletonMediaCard key={`skeleton-media-${i}`} />)}
          </div>
        ) : error ? (
          <ErrorAlert error={error} onRetry={() => refetch()} />
        ) : viewMode === 'grid' ? (
          <MediaGrid
            media={media}
            onDelete={setDeletingMedia}
            onEditTags={openTagEditor}
            mediaUsage={mediaUsageSummaries}
            onUploadClick={() => setUploadOpen(true)}
            selectedIds={selectedIds}
            onToggleSelect={(item) => toggleSelected(item.id)}
          />
        ) : (
          <MediaListView
            media={media}
            onDelete={setDeletingMedia}
            onEditTags={openTagEditor}
            onUploadClick={() => setUploadOpen(true)}
            selectedIds={selectedIds}
            onToggleSelect={(item) => toggleSelected(item.id)}
          />
        )}

        {/* Bulk-Action-Leiste — fixed, erscheint sobald Auswahl aktiv */}
        {selectedIds.size > 0 && (
          <div
            role="toolbar"
            aria-label="Mehrfach-Aktionen"
            className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-spa-bg-secondary bg-spa-surface px-4 py-3 shadow-2xl"
          >
            <span className="text-sm font-semibold text-spa-text-primary">
              {selectedIds.size} ausgewählt
            </span>
            <div className="mx-2 h-5 w-px bg-spa-bg-secondary" />
            <Button
              variant="ghost"
              size="sm"
              icon={CheckSquare}
              onClick={() => selectAllVisible(media)}
              disabled={selectedIds.size === media.length}
            >
              Alle sichtbaren
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Tags}
              onClick={openBulkTagEditor}
            >
              Tags
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={handleBulkDeleteRequest}
            >
              Löschen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={X}
              onClick={clearSelection}
              aria-label="Auswahl aufheben"
            />
          </div>
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

        {/* Bulk Delete Confirm */}
        <ConfirmDialog
          isOpen={bulkDeleteOpen}
          title={`${selectedIds.size} Datei${selectedIds.size === 1 ? '' : 'en'} löschen?`}
          message={(() => {
            const usedCount = Array.from(selectedIds).filter((id) => {
              const usage = mediaUsageSummaries.get(id);
              return usage && usage.length > 0;
            }).length;
            const base = `Möchtest du wirklich ${selectedIds.size} Datei${selectedIds.size === 1 ? '' : 'en'} löschen? Diese Aktion kann nicht rückgängig gemacht werden.`;
            if (usedCount > 0) {
              return `${base}\n\n⚠️ ${usedCount} davon wird/werden derzeit verwendet (z. B. in Slideshows). Das Löschen kann zu fehlenden Inhalten führen.`;
            }
            return base;
          })()}
          confirmLabel={bulkDeleting ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={handleBulkDeleteConfirm}
          onCancel={() => setBulkDeleteOpen(false)}
        />

        {/* Bulk Tag Editor */}
        <Dialog
          isOpen={bulkTagging}
          onClose={closeBulkTagEditor}
          title={`Tags für ${selectedIds.size} Datei${selectedIds.size === 1 ? '' : 'en'} bearbeiten`}
          size="md"
          closeDisabled={bulkTagSaving}
          footer={(
            <>
              <Button variant="ghost" onClick={closeBulkTagEditor} disabled={bulkTagSaving}>
                Abbrechen
              </Button>
              <Button
                icon={Tags}
                onClick={handleSaveBulkTags}
                loading={bulkTagSaving}
                loadingText="Speichert..."
              >
                Anwenden
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            {/* Mode-Tabs: hinzufügen vs. ersetzen */}
            <div className="inline-flex rounded-lg border border-spa-bg-secondary bg-spa-surface p-1">
              <button
                type="button"
                onClick={() => setBulkTagMode('add')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  bulkTagMode === 'add'
                    ? 'bg-spa-primary text-white'
                    : 'text-spa-text-secondary hover:text-spa-text-primary'
                }`}
              >
                Hinzufügen
              </button>
              <button
                type="button"
                onClick={() => setBulkTagMode('replace')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  bulkTagMode === 'replace'
                    ? 'bg-spa-primary text-white'
                    : 'text-spa-text-secondary hover:text-spa-text-primary'
                }`}
              >
                Ersetzen
              </button>
            </div>
            <p className="text-xs text-spa-text-secondary -mt-2">
              {bulkTagMode === 'add'
                ? 'Die ausgewählten Tags werden zu allen Dateien hinzugefügt — bestehende Tags bleiben erhalten.'
                : 'Bestehende Tags werden vollständig durch die unten gewählten Tags ersetzt.'}
            </p>
            <ComboboxField
              label={bulkTagMode === 'add' ? 'Tag hinzufügen' : 'Neuer Tag'}
              value=""
              onChange={(val) => {
                if (!val.trim()) return;
                const currentTags = normalizeTagsInput(bulkTagDraft);
                if (!hasTagCaseInsensitive(currentTags, val.trim())) {
                  setBulkTagDraft([...currentTags, val.trim()].join(', '));
                }
              }}
              options={availableTags.filter((tag) => !hasTagCaseInsensitive(parsedBulkTagDraft, tag))}
              placeholder="Tag eingeben oder auswählen..."
              createLabel="Neues Tag"
            />
            {parsedBulkTagDraft.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-spa-text-primary mb-2">Anzuwendende Tags</p>
                <div className="flex flex-wrap gap-2">
                  {parsedBulkTagDraft.map((tag) => (
                    <button
                      key={`bulk-tag-${tag}`}
                      type="button"
                      onClick={() => {
                        const filtered = parsedBulkTagDraft.filter(
                          (entry) => entry.localeCompare(tag, 'de', { sensitivity: 'accent' }) !== 0,
                        );
                        setBulkTagDraft(filtered.join(', '));
                      }}
                      className="rounded-full px-3 py-1 text-xs border bg-spa-primary text-white border-spa-primary hover:bg-spa-primary/80 transition-colors"
                      title="Klicken zum Entfernen"
                    >
                      #{tag} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-spa-text-secondary">
                {bulkTagMode === 'replace'
                  ? 'Keine Tags ausgewählt — die Dateien werden mit leerer Tag-Liste gespeichert.'
                  : 'Keine Tags zum Hinzufügen ausgewählt.'}
              </p>
            )}
          </div>
        </Dialog>

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
  onUploadClick,
  selectedIds,
  onToggleSelect,
}: {
  media: Media[];
  onDelete: (media: Media) => void;
  onEditTags: (media: Media) => void;
  onUploadClick?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (media: Media) => void;
}) {
  if (media.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Keine Medien gefunden"
        description="Lade deine ersten Dateien hoch, um loszulegen."
        action={
          onUploadClick ? (
            <Button icon={Upload} onClick={onUploadClick}>
              Erste Datei hochladen
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="rounded-2xl border border-spa-bg-secondary bg-spa-surface overflow-hidden divide-y divide-spa-bg-secondary">
      {media.map((item) => (
        <MediaListRow
          key={item.id}
          item={item}
          onDelete={onDelete}
          onEditTags={onEditTags}
          isSelected={selectedIds?.has(item.id) ?? false}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

function MediaListRow({
  item,
  onDelete,
  onEditTags,
  isSelected = false,
  onToggleSelect,
}: {
  item: Media;
  onDelete: (media: Media) => void;
  onEditTags: (media: Media) => void;
  isSelected?: boolean;
  onToggleSelect?: (media: Media) => void;
}) {
  const mediaUrl = toAbsoluteMediaUrl(item.url);
  const { summary } = useMediaMetadata(mediaUrl, item.type);

  return (
    <div
      className={`flex items-center gap-4 p-3 hover:bg-spa-bg-primary transition-colors ${
        isSelected ? 'bg-spa-primary/5' : ''
      }`}
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item)}
          aria-label={isSelected ? `${item.originalName} abwählen` : `${item.originalName} auswählen`}
          className="h-4 w-4 shrink-0 rounded border-spa-bg-secondary accent-spa-primary"
        />
      )}
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
