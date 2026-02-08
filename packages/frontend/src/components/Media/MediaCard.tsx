import { useState } from 'react';
import { MoreVertical, Trash2, Download, Image as ImageIcon, Music, Film, Copy } from 'lucide-react';
import type { Media } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface MediaCardProps {
  media: Media;
  onDelete: (media: Media) => void;
}

export function MediaCard({ media, onDelete }: MediaCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Construct full URL for media
  const mediaUrl = `${API_URL}${media.url}`;

  const getIcon = () => {
    switch (media.type) {
      case 'image':
        return ImageIcon;
      case 'audio':
        return Music;
      case 'video':
        return Film;
      default:
        return ImageIcon;
    }
  };

  const Icon = getIcon();

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mediaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setMenuOpen(false);
  };

  const handleDownload = () => {
    window.open(mediaUrl, '_blank');
    setMenuOpen(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-spa-bg-secondary hover:shadow-md transition-shadow overflow-hidden">
      {/* Preview */}
      <div className="aspect-square bg-spa-bg-primary relative">
        {media.type === 'image' ? (
          <img
            src={mediaUrl}
            alt={media.originalName}
            className="w-full h-full object-cover"
          />
        ) : media.type === 'video' ? (
          <>
            <video
              src={mediaUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                <Film className="w-8 h-8 text-spa-primary" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-16 h-16 text-spa-primary/30" />
          </div>
        )}

        {/* Menu Button */}
        <div className="absolute top-2 right-2">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 bg-white/90 hover:bg-white rounded-lg transition-colors shadow-sm"
          >
            <MoreVertical className="w-4 h-4 text-spa-text-secondary" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-spa-bg-secondary z-20">
                <div className="py-1">
                  <button
                    onClick={handleCopyUrl}
                    className="w-full px-4 py-2 text-left text-sm text-spa-text-primary hover:bg-spa-bg-primary flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Kopiert!' : 'URL kopieren'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="w-full px-4 py-2 text-left text-sm text-spa-text-primary hover:bg-spa-bg-primary flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Herunterladen
                  </button>
                  <div className="border-t border-spa-bg-secondary my-1" />
                  <button
                    onClick={() => {
                      onDelete(media);
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Löschen
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Type Badge */}
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/90 text-spa-text-primary text-xs font-medium rounded-full">
            <Icon className="w-3 h-3" />
            {media.type}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-medium text-spa-text-primary truncate" title={media.originalName}>
          {media.originalName}
        </p>
        <div className="flex items-center justify-between mt-2 text-xs text-spa-text-secondary">
          <span>{formatFileSize(media.size)}</span>
          <span>{new Date(media.createdAt).toLocaleDateString('de-DE')}</span>
        </div>
      </div>
    </div>
  );
}
