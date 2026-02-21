import { Link } from 'react-router-dom';
import { Image, Music, Play } from 'lucide-react';
import { formatFileSize } from '@/types/media.types';
import { formatRelativeTime } from '@/utils/dateUtils';

interface MediaInsightsWidgetProps {
  images: number;
  audio: number;
  videos: number;
  totalSize: number;
  latestMediaName: string | null;
  latestMediaDate: Date | null;
}

export function MediaInsightsWidget({
  images,
  audio,
  videos,
  totalSize,
  latestMediaName,
  latestMediaDate,
}: MediaInsightsWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
          <Image className="w-5 h-5" />
          Medien-Insights
        </h3>
        <Link
          to="/media"
          className="text-xs font-semibold text-spa-primary hover:text-spa-primary-dark transition-colors"
        >
          Zur Mediathek
        </Link>
      </div>
      <div className="space-y-3 text-sm text-spa-text-secondary">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2"><Image className="w-4 h-4" /> Bilder</span>
          <span className="font-semibold text-spa-text-primary">{images}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2"><Music className="w-4 h-4" /> Audio</span>
          <span className="font-semibold text-spa-text-primary">{audio}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2"><Play className="w-4 h-4" /> Video</span>
          <span className="font-semibold text-spa-text-primary">{videos}</span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-spa-bg-secondary">
          <span>Gesamtgröße</span>
          <span className="font-semibold text-spa-text-primary">{formatFileSize(totalSize)}</span>
        </div>
        {latestMediaName && (
          <div className="pt-2 border-t border-spa-bg-secondary">
            <p className="text-xs uppercase tracking-wide text-spa-text-secondary mb-1">Letzter Upload</p>
            <p className="font-medium text-spa-text-primary truncate">{latestMediaName}</p>
            {latestMediaDate && (
              <p className="text-xs text-spa-text-secondary mt-0.5">
                {formatRelativeTime(latestMediaDate)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
