import { useEffect, useMemo, useState } from 'react';
import type { MediaType } from '@/types/media.types';

export interface MediaMetadataInfo {
  width?: number;
  height?: number;
  durationSec?: number;
}

const metadataCache = new Map<string, MediaMetadataInfo>();

function loadImageMetadata(src: string): Promise<MediaMetadataInfo> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Bild-Metadaten konnten nicht geladen werden.'));
    image.src = src;
  });
}

function loadAudioMetadata(src: string): Promise<MediaMetadataInfo> {
  return new Promise((resolve, reject) => {
    const element = document.createElement('audio');
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      resolve({
        durationSec: Number.isFinite(element.duration) ? element.duration : undefined,
      });
    };
    element.onerror = () => reject(new Error('Medien-Metadaten konnten nicht geladen werden.'));
    element.src = src;
  });
}

function loadVideoMetadata(src: string): Promise<MediaMetadataInfo> {
  return new Promise((resolve, reject) => {
    const element = document.createElement('video');
    element.preload = 'metadata';
    element.onloadedmetadata = () => {
      resolve({
        durationSec: Number.isFinite(element.duration) ? element.duration : undefined,
        width: element.videoWidth || undefined,
        height: element.videoHeight || undefined,
      });
    };
    element.onerror = () => reject(new Error('Video-Metadaten konnten nicht geladen werden.'));
    element.src = src;
  });
}

function getMetadataCacheKey(src: string, type: MediaType): string {
  return `${type}:${src}`;
}

export function formatMediaDuration(durationSec?: number): string | null {
  if (!durationSec || !Number.isFinite(durationSec)) return null;
  const totalSeconds = Math.max(1, Math.round(durationSec));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatMediaMetadataSummary(metadata: MediaMetadataInfo, type: MediaType): string | null {
  if (type === 'image' || type === 'video') {
    if (metadata.width && metadata.height) {
      const sizeLabel = `${metadata.width}×${metadata.height}`;
      const durationLabel = type === 'video' ? formatMediaDuration(metadata.durationSec) : null;
      return durationLabel ? `${sizeLabel} · ${durationLabel}` : sizeLabel;
    }
  }

  if (type === 'audio') {
    return formatMediaDuration(metadata.durationSec);
  }

  if (type === 'video') {
    return formatMediaDuration(metadata.durationSec);
  }

  return null;
}

export function useMediaMetadata(src: string | null | undefined, type: MediaType) {
  const cacheKey = useMemo(
    () => (src ? getMetadataCacheKey(src, type) : null),
    [src, type],
  );
  const [metadata, setMetadata] = useState<MediaMetadataInfo | null>(
    () => (cacheKey ? metadataCache.get(cacheKey) || null : null),
  );
  const [isLoading, setIsLoading] = useState(() => Boolean(src && cacheKey && !metadataCache.has(cacheKey)));

  useEffect(() => {
    if (!src || !cacheKey) {
      setMetadata(null);
      setIsLoading(false);
      return;
    }

    const cached = metadataCache.get(cacheKey);
    if (cached) {
      setMetadata(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    const loader = type === 'image'
      ? loadImageMetadata(src)
      : type === 'audio'
        ? loadAudioMetadata(src)
        : loadVideoMetadata(src);

    loader
      .then((nextMetadata) => {
        if (cancelled) return;
        metadataCache.set(cacheKey, nextMetadata);
        setMetadata(nextMetadata);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, src, type]);

  return {
    metadata,
    isLoading,
    summary: metadata ? formatMediaMetadataSummary(metadata, type) : null,
  };
}
