import { API_URL } from '@/config/env';
import type { Media } from '@/types/media.types';

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export function buildUploadUrl(filename: string): string {
  return `${API_URL}/uploads/${filename}`;
}

export function toAbsoluteMediaUrl(urlOrPath: string): string {
  if (ABSOLUTE_URL_PATTERN.test(urlOrPath)) {
    return urlOrPath;
  }
  if (!urlOrPath) {
    return API_URL;
  }

  return `${API_URL}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}

export function findMediaById(media: Media[] | undefined, mediaId?: string): Media | undefined {
  if (!mediaId) return undefined;
  return media?.find((item) => item.id === mediaId);
}

export function getMediaUploadUrl(media: Media[] | undefined, mediaId?: string): string | null {
  const item = findMediaById(media, mediaId);
  if (!item) return null;
  return buildUploadUrl(item.filename);
}
