import { MediaCard } from './MediaCard';
import type { Media } from '@/types/media.types';
import { ImageIcon, Upload } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';

interface MediaGridProps {
  media: Media[];
  onDelete: (media: Media) => void;
  onEditTags?: (media: Media) => void;
  mediaUsage?: Map<string, string[]>;
  onUploadClick?: () => void;
}

export function MediaGrid({ media, onDelete, onEditTags, mediaUsage, onUploadClick }: MediaGridProps) {
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {media.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          onDelete={onDelete}
          onEditTags={onEditTags}
          usageSummary={mediaUsage?.get(item.id)}
        />
      ))}
    </div>
  );
}
