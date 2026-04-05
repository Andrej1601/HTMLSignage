import { useState } from 'react';
import { MoreVertical, Trash2, Download, Music, Copy, Tags, Link2, Play } from 'lucide-react';
import type { Media } from '@/types/media.types';
import { formatFileSize } from '@/types/media.types';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useMediaMetadata } from '@/hooks/useMediaMetadata';
import { formatRelativeTime } from '@/utils/dateUtils';

interface MediaCardProps {
  media: Media;
  onDelete: (media: Media) => void;
  onEditTags?: (media: Media) => void;
  usageSummary?: string[];
}

const typeBadgeStyles: Record<string, string> = {
  image: 'bg-amber-600 text-white',
  video: 'bg-red-600 text-white',
  audio: 'bg-violet-600 text-white',
};

const typeLabels: Record<string, string> = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
};

export function MediaCard({ media, onDelete, onEditTags, usageSummary }: MediaCardProps) {
  const [copied, setCopied] = useState(false);
  const mediaUrl = toAbsoluteMediaUrl(media.url);
  const { summary: mediaSummary } = useMediaMetadata(mediaUrl, media.type);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(mediaUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.open(mediaUrl, '_blank');
  };

  return (
    <div className="group overflow-hidden rounded-2xl border border-spa-bg-secondary bg-white shadow-xs transition-all hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-spa-bg-primary">
        {media.type === 'image' ? (
          <img
            src={mediaUrl}
            alt={media.originalName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : media.type === 'video' ? (
          <>
            <video
              src={mediaUrl}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                <Play className="h-5 w-5 text-spa-text-primary ml-0.5" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Music className="h-12 w-12 text-spa-primary/25" />
          </div>
        )}

        {/* Type Badge */}
        <span className={`absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ${typeBadgeStyles[media.type] || typeBadgeStyles.image}`}>
          {typeLabels[media.type] || 'FILE'}
        </span>

        {/* Menu (visible on hover) */}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu
            ariaLabel="Medien-Aktionen"
            width="w-48"
            trigger={() => (
              <button
                className="rounded-lg bg-white/90 p-1.5 shadow-xs transition-colors hover:bg-white"
                aria-label="Medien-Aktionen"
                type="button"
              >
                <MoreVertical className="h-4 w-4 text-spa-text-secondary" aria-hidden="true" />
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
      </div>

      {/* Info */}
      <div className="px-4 py-3">
        <p className="text-sm font-medium text-spa-text-primary truncate" title={media.originalName}>
          {media.originalName}
        </p>
        <p className="mt-0.5 text-xs text-spa-text-secondary">
          {formatFileSize(media.size)}
          {' · '}
          {formatRelativeTime(new Date(media.createdAt))}
        </p>
        {mediaSummary && (
          <p className="mt-0.5 text-xs text-spa-text-secondary">{mediaSummary}</p>
        )}
        {media.tags && media.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {media.tags.slice(0, 3).map((tag) => (
              <span
                key={`${media.id}-${tag}`}
                className="inline-flex items-center rounded-full bg-spa-secondary/15 px-2 py-0.5 text-[11px] font-medium text-spa-text-primary"
              >
                {tag}
              </span>
            ))}
            {media.tags.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-spa-bg-secondary px-2 py-0.5 text-[11px] text-spa-text-secondary">
                +{media.tags.length - 3}
              </span>
            )}
          </div>
        )}
        {usageSummary && usageSummary.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-spa-info-dark">
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="truncate" title={usageSummary.join(', ')}>
              {usageSummary.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
