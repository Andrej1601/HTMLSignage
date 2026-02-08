import { memo } from 'react';
import type { SlideConfig } from '@/types/slideshow.types';
import { useSettings } from '@/hooks/useSettings';
import { useMedia } from '@/hooks/useMedia';
import { Film, Calendar, Flame, Clock } from 'lucide-react';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';

interface SlidePreviewProps {
  slide: SlideConfig;
  className?: string;
}

/**
 * SlidePreview component renders a miniature preview of a slide
 * Size: 160x90px (16:9 aspect ratio)
 */
export const SlidePreview = memo(function SlidePreview({ slide, className = '' }: SlidePreviewProps) {
  const { settings } = useSettings();
  const { data: media } = useMedia();

  const baseClasses = 'w-40 h-[90px] rounded-md overflow-hidden border-2 border-spa-bg-secondary shadow-sm bg-spa-bg-primary flex items-center justify-center relative';

  switch (slide.type) {
    case 'content-panel':
      return <ContentPanelPreview className={`${baseClasses} ${className}`} />;

    case 'sauna-detail':
      return (
        <SaunaDetailPreview
          className={`${baseClasses} ${className}`}
          saunaId={slide.saunaId}
          settings={settings}
          media={media}
        />
      );

    case 'media-image':
      return (
        <MediaImagePreview
          className={`${baseClasses} ${className}`}
          mediaId={slide.mediaId}
          media={media}
        />
      );

    case 'media-video':
      return (
        <MediaVideoPreview
          className={`${baseClasses} ${className}`}
          mediaId={slide.mediaId}
          media={media}
        />
      );

    case 'sauna-overview':
      return (
        <SaunaOverviewPreview
          className={`${baseClasses} ${className}`}
          settings={settings}
        />
      );

    case 'current-aufguss':
      return <CurrentAufgussPreview className={`${baseClasses} ${className}`} />;

    default:
      return (
        <div className={`${baseClasses} ${className}`}>
          <span className="text-xs text-spa-text-secondary">Unknown</span>
        </div>
      );
  }
});

// Content Panel Preview (mini schedule grid)
function ContentPanelPreview({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="w-full h-full p-1 bg-gradient-to-br from-spa-primary/10 to-spa-secondary/10">
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-full">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-sm flex items-center justify-center"
              style={{ opacity: 0.3 + (i % 3) * 0.2 }}
            >
              <Calendar className="w-2 h-2 text-spa-primary" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-1 left-1 bg-spa-primary text-white px-1.5 py-0.5 rounded text-[8px] font-semibold">
        Grid
      </div>
    </div>
  );
}

// Sauna Detail Preview
function SaunaDetailPreview({ className, saunaId, settings, media }: any) {
  const sauna = settings?.saunas?.find((s: any) => s.id === saunaId);

  if (!sauna) {
    return (
      <div className={className}>
        <span className="text-xs text-spa-text-secondary">Keine Sauna</span>
      </div>
    );
  }

  const saunaImage = sauna.imageId ? media?.find((m: any) => m.id === sauna.imageId) : null;
  const imageUrl = saunaImage ? `${API_URL}/uploads/${saunaImage.filename}` : null;

  return (
    <div className={className}>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={sauna.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/40 to-black/60"
        style={{ backgroundColor: imageUrl ? 'transparent' : sauna.color || '#10b981' }}
      />
      <div className="relative z-10 text-white p-2 text-center">
        <div className="text-xs font-bold mb-1 truncate">{sauna.name}</div>
        {sauna.info?.temperature && (
          <div className="flex items-center justify-center gap-1 text-[10px]">
            <Flame className="w-3 h-3" />
            <span>{sauna.info.temperature}°C</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Media Image Preview
function MediaImagePreview({ className, mediaId, media }: any) {
  const mediaItem = media?.find((m: any) => m.id === mediaId);

  if (!mediaItem) {
    return (
      <div className={className}>
        <span className="text-xs text-spa-text-secondary">Kein Bild</span>
      </div>
    );
  }

  const imageUrl = `${API_URL}/uploads/${mediaItem.filename}`;

  return (
    <div className={className}>
      <img
        src={imageUrl}
        alt={mediaItem.originalName}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute bottom-1 left-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-[8px]">
        Bild
      </div>
    </div>
  );
}

// Media Video Preview
function MediaVideoPreview({ className, mediaId, media }: any) {
  const mediaItem = media?.find((m: any) => m.id === mediaId);

  if (!mediaItem) {
    return (
      <div className={className}>
        <span className="text-xs text-spa-text-secondary">Kein Video</span>
      </div>
    );
  }

  const videoUrl = `${API_URL}/uploads/${mediaItem.filename}`;

  return (
    <div className={className}>
      <video
        src={videoUrl}
        className="w-full h-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
          <Film className="w-4 h-4 text-spa-primary" />
        </div>
      </div>
      <div className="absolute bottom-1 left-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-[8px]">
        Video
      </div>
    </div>
  );
}

// Sauna Overview Preview
function SaunaOverviewPreview({ className, settings }: any) {
  const saunas = settings?.saunas?.filter((s: any) => s.status !== 'hidden') || [];
  const displaySaunas = saunas.slice(0, 4); // Show max 4 in preview

  return (
    <div className={className}>
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-full h-full p-1">
        {displaySaunas.map((sauna: any) => (
          <div
            key={sauna.id}
            className="rounded-sm flex flex-col items-center justify-center text-white text-[8px] font-semibold"
            style={{ backgroundColor: sauna.color || '#10b981' }}
          >
            <Flame className="w-2.5 h-2.5 mb-0.5" />
            <span className="truncate max-w-[90%]">{sauna.name.split(' ')[0]}</span>
          </div>
        ))}
      </div>
      <div className="absolute bottom-1 left-1 bg-spa-primary text-white px-1.5 py-0.5 rounded text-[8px] font-semibold">
        Übersicht
      </div>
    </div>
  );
}

// Current Aufguss Preview
function CurrentAufgussPreview({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="w-full h-full bg-gradient-to-br from-spa-accent/20 to-spa-accent/40 flex flex-col items-center justify-center text-spa-text-primary">
        <Clock className="w-6 h-6 mb-1 text-spa-accent" />
        <div className="text-[9px] font-semibold">Aktueller</div>
        <div className="text-[9px] font-semibold">Aufguss</div>
      </div>
      <div className="absolute bottom-1 left-1 bg-spa-accent text-white px-1.5 py-0.5 rounded text-[8px] font-semibold">
        Event
      </div>
    </div>
  );
}
