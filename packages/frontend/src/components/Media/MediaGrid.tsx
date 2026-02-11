import { MediaCard } from './MediaCard';
import type { Media } from '@/types/media.types';
import { ImageIcon } from 'lucide-react';

interface MediaGridProps {
  media: Media[];
  onDelete: (media: Media) => void;
}

export function MediaGrid({ media, onDelete }: MediaGridProps) {
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {media.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
