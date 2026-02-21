import type { Media } from '@/types/media.types';
import { buildUploadUrl } from '@/utils/mediaUrl';
import { Film } from 'lucide-react';
import clsx from 'clsx';

interface MediaPickerFieldProps {
  supportsVideo: boolean;
  images: Media[];
  videos: Media[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function MediaPickerField({
  supportsVideo,
  images,
  videos,
  selectedId,
  onSelect,
}: MediaPickerFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-spa-text-primary mb-2">
        {supportsVideo ? 'Video auswählen' : 'Bild auswählen'} *
      </label>
      {supportsVideo ? (
        videos.length === 0 ? (
          <p className="text-sm text-red-600">
            Keine Videos hochgeladen. Bitte lade zuerst Videos hoch.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {videos.map((video) => (
              <button
                key={video.id}
                onClick={() => onSelect(video.id)}
                className={clsx(
                  'relative rounded-lg border-2 overflow-hidden transition-all group',
                  selectedId === video.id
                    ? 'border-spa-primary ring-2 ring-spa-primary'
                    : 'border-spa-bg-secondary hover:border-spa-primary/50'
                )}
              >
                <div className="relative w-full h-24 bg-gray-900">
                  <video
                    src={buildUploadUrl(video.filename)}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                    <Film className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="px-2 py-1 text-xs text-spa-text-primary truncate bg-white">
                  {video.originalName}
                </div>
              </button>
            ))}
          </div>
        )
      ) : images.length === 0 ? (
        <p className="text-sm text-red-600">
          Keine Bilder hochgeladen. Bitte lade zuerst Bilder hoch.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelect(img.id)}
              className={clsx(
                'relative rounded-lg border-2 overflow-hidden transition-all',
                selectedId === img.id
                  ? 'border-spa-primary ring-2 ring-spa-primary'
                  : 'border-spa-bg-secondary hover:border-spa-primary/50'
              )}
            >
              <img
                src={buildUploadUrl(img.filename)}
                alt={img.originalName}
                className="w-full h-24 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
