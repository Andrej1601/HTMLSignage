import { Monitor } from 'lucide-react';
import { toAbsoluteMediaUrl } from '@/utils/mediaUrl';

interface DeviceSnapshotPreviewProps {
  snapshotUrl?: string | null;
  capturedAt?: string | null;
  alt: string;
  className?: string;
  compact?: boolean;
}

function formatCapturedAt(value?: string | null): string {
  if (!value) return 'Noch kein Live-Snapshot';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Snapshot-Zeit unbekannt';
  return `Snapshot ${date.toLocaleDateString('de-DE')} · ${date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function DeviceSnapshotPreview({
  snapshotUrl,
  capturedAt,
  alt,
  className = '',
  compact = false,
}: DeviceSnapshotPreviewProps) {
  const resolvedSnapshotUrl = snapshotUrl ? toAbsoluteMediaUrl(snapshotUrl) : null;

  return (
    <div className={`overflow-hidden rounded-xl border border-spa-bg-secondary bg-spa-bg-primary ${className}`}>
      <div className={`relative w-full ${compact ? 'aspect-[16/10]' : 'aspect-video'}`}>
        {resolvedSnapshotUrl ? (
          <img
            src={resolvedSnapshotUrl}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-spa-bg-primary to-spa-surface">
            <div className="text-center">
              <Monitor className="mx-auto h-8 w-8 text-spa-primary/35" />
              <div className="mt-2 text-xs text-spa-text-secondary">
                Noch kein Snapshot
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-spa-bg-secondary bg-spa-surface/80 px-3 py-2 text-[11px] text-spa-text-secondary">
        {formatCapturedAt(capturedAt)}
      </div>
    </div>
  );
}
