import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { MediaUpload } from '@/components/Media/MediaUpload';
import { MediaGrid } from '@/components/Media/MediaGrid';
import { useMedia, useDeleteMedia } from '@/hooks/useMedia';
import type { Media, MediaType } from '@/types/media.types';
import { ImageIcon, RefreshCw, Upload, Filter } from 'lucide-react';

export function MediaPage() {
  const [typeFilter, setTypeFilter] = useState<MediaType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<Media | null>(null);

  const filter = {
    type: typeFilter === 'all' ? undefined : typeFilter,
    search: searchQuery || undefined,
  };

  const { data: media = [], isLoading, refetch } = useMedia(filter);
  const deleteMedia = useDeleteMedia();

  const handleDeleteMedia = () => {
    if (!deletingMedia) return;

    deleteMedia.mutate(deletingMedia.id, {
      onSuccess: () => {
        setDeletingMedia(null);
      }
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Medien..." />
      </Layout>
    );
  }

  const stats = {
    total: media.length,
    images: media.filter(m => m.type === 'image').length,
    audio: media.filter(m => m.type === 'audio').length,
    video: media.filter(m => m.type === 'video').length,
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

  return (
    <Layout>
      <div>
        <PageHeader
          title="Medien-Bibliothek"
          description="Verwalte Bilder, Audio und Video für die Ausspielung."
          icon={ImageIcon}
          actions={(
            <>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Aktualisieren
              </button>
              <button
                onClick={() => setUploadOpen(!uploadOpen)}
                className="px-6 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploadOpen ? 'Upload schließen' : 'Hochladen'}
              </button>
            </>
          )}
          badges={[
            { label: `${stats.total} Dateien`, tone: 'info' },
            { label: `Filter: ${activeTypeFilter}`, tone: typeFilter === 'all' ? 'neutral' : 'info' },
            { label: trimmedSearch ? `Suche: ${trimmedSearch}` : 'Keine Suche', tone: trimmedSearch ? 'warning' : 'neutral' },
          ]}
        />

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-spa-bg-primary rounded-lg">
                  <ImageIcon className="w-6 h-6 text-spa-primary" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Gesamt</p>
                  <p className="text-2xl font-bold text-spa-text-primary">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ImageIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Bilder</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.images}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ImageIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Audio</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.audio}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <ImageIcon className="w-6 h-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-spa-text-secondary">Video</p>
                  <p className="text-2xl font-bold text-pink-600">{stats.video}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Section */}
          {uploadOpen && (
            <div className="mb-6">
              <MediaUpload onUploadComplete={() => refetch()} />
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Type Filter */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Filter className="w-5 h-5 text-spa-text-secondary" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-4 py-2 border border-spa-bg-secondary rounded-lg focus:ring-2 focus:ring-spa-primary focus:border-transparent"
                >
                  <option value="all">Alle Typen</option>
                  <option value="image">Bilder</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
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
            </div>
          </div>

        {/* Media Grid */}
        <MediaGrid
          media={media}
          onDelete={setDeletingMedia}
        />

        {/* Delete Confirmation Dialog */}
        {deletingMedia && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-spa-text-primary mb-4">
                Datei löschen?
              </h3>
              <p className="text-spa-text-secondary mb-6">
                Möchtest du die Datei "{deletingMedia.originalName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDeletingMedia(null)}
                  disabled={deleteMedia.isPending}
                  className="flex-1 px-4 py-2 bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleDeleteMedia}
                  disabled={deleteMedia.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMedia.isPending ? 'Wird gelöscht...' : 'Löschen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
