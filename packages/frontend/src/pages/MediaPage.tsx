import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { MediaUpload } from '@/components/Media/MediaUpload';
import { MediaGrid } from '@/components/Media/MediaGrid';
import { useMedia, useDeleteMedia } from '@/hooks/useMedia';
import type { Media, MediaType } from '@/types/media.types';
import { StatCard } from '@/components/Dashboard/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ImageIcon, RefreshCw, Upload, Filter, Music, Film } from 'lucide-react';

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
            <StatCard title="Gesamt" value={stats.total} icon={ImageIcon} color="primary" />
            <StatCard title="Bilder" value={stats.images} icon={ImageIcon} color="info" />
            <StatCard title="Audio" value={stats.audio} icon={Music} color="violet" />
            <StatCard title="Video" value={stats.video} icon={Film} color="success" />
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

        <ConfirmDialog
          isOpen={Boolean(deletingMedia)}
          title="Datei löschen?"
          message={`Möchtest du die Datei "${deletingMedia?.originalName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel={deleteMedia.isPending ? 'Wird gelöscht...' : 'Löschen'}
          variant="danger"
          onConfirm={handleDeleteMedia}
          onCancel={() => setDeletingMedia(null)}
        />
      </div>
    </Layout>
  );
}
