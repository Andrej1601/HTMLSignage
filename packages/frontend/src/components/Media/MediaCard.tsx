import { useState } from 'react';
import { MoreVertical, Trash2, Download, Image as ImageIcon, Music, Film, Copy } from 'lucide-react';
import type { Media } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { DropdownMenu } from '@/components/ui/DropdownMenu';

interface MediaCardProps {
  media: Media;
  onDelete: (media: Media) => void;
}

export function MediaCard({ media, onDelete }: MediaCardProps) {
  const [copied, setCopied] = useState(false);

  // Construct full URL for media
  const mediaUrl = toAbsoluteMediaUrl(media.url);

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
  };

  const handleDownload = () => {
    window.open(mediaUrl, '_blank');
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
            loading="lazy"
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
          <DropdownMenu
            ariaLabel="Medien-Aktionen"
            width="w-48"
            trigger={() => (
              <button
                className="p-2 bg-white/90 hover:bg-white rounded-lg transition-colors shadow-sm"
                aria-label="Medien-Aktionen"
                type="button"
              >
                <MoreVertical className="w-4 h-4 text-spa-text-secondary" aria-hidden="true" />
              </button>
            )}
            sections={[
              [
                { label: copied ? 'Kopiert!' : 'URL kopieren', icon: Copy, onClick: handleCopyUrl },
                { label: 'Herunterladen', icon: Download, onClick: handleDownload },
              ],
              [{ label: 'Löschen', icon: Trash2, onClick: () => onDelete(media), variant: 'danger' }],
            ]}
          />
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
