import { useState } from 'react';
import { MoreVertical, Trash2, Download, Image as ImageIcon, Music, Film, Copy, Tags, Link2 } from 'lucide-react';
import type { Media } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useMediaMetadata } from '@/hooks/useMediaMetadata';

interface MediaCardProps {
  media: Media;
  onDelete: (media: Media) => void;
  onEditTags?: (media: Media) => void;
  usageSummary?: string[];
}

export function MediaCard({ media, onDelete, onEditTags, usageSummary }: MediaCardProps) {
  const [copied, setCopied] = useState(false);

  // Construct full URL for media
  const mediaUrl = toAbsoluteMediaUrl(media.url);
  const { summary: mediaSummary } = useMediaMetadata(mediaUrl, media.type);

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
    <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all overflow-hidden border-spa-bg-secondary">
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
                ...(onEditTags ? [{ label: 'Tags bearbeiten', icon: Tags, onClick: () => onEditTags(media) }] : []),
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
        {media.tags && media.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {media.tags.slice(0, 3).map((tag) => (
              <span
                key={`${media.id}-${tag}`}
                className="inline-flex items-center rounded-full bg-spa-secondary/15 px-2 py-0.5 text-[11px] text-spa-text-primary"
              >
                #{tag}
              </span>
            ))}
            {media.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-spa-bg-secondary px-2 py-0.5 text-[11px] text-spa-text-secondary">
                +{media.tags.length - 3}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mt-2 text-xs text-spa-text-secondary">
          <span>{formatFileSize(media.size)}</span>
          <span>{new Date(media.createdAt).toLocaleDateString('de-DE')}</span>
        </div>
        {mediaSummary && (
          <div className="mt-1 text-xs text-spa-text-secondary">
            {mediaSummary}
          </div>
        )}
        {usageSummary && usageSummary.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-spa-info-dark">
            <Link2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate" title={usageSummary.join(', ')}>
              {usageSummary.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
