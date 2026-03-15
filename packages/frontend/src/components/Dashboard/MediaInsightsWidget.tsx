import { Link } from 'react-router-dom';
import { Image, Music, Play } from 'lucide-react';
import { formatFileSize } from '@/types/media.types';
import { formatRelativeTime } from '@/utils/dateUtils';
import { DashboardWidgetFrame } from '@/components/Dashboard/DashboardWidgetFrame';

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
    <DashboardWidgetFrame
      title="Medien-Insights"
      description="Bestand, Medientypen und letzte Uploads für die Ausspielung."
      icon={Image}
      actions={(
        <Link
          to="/media"
          className="text-xs font-semibold text-spa-primary transition-colors hover:text-spa-primary-dark"
        >
          Zur Mediathek
        </Link>
      )}
    >
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
    </DashboardWidgetFrame>
  );
}
