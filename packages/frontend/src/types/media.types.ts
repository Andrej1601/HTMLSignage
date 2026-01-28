export type MediaType = 'image' | 'audio' | 'video';

export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number; // bytes
  type: MediaType;
  url: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadMediaRequest {
  file: File;
  type?: MediaType;
}

export interface MediaFilter {
  type?: MediaType;
  search?: string;
}

// Helper functions
export function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'image'; // fallback
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getMediaIcon(type: MediaType): string {
  switch (type) {
    case 'image':
      return '🖼️';
    case 'audio':
      return '🎵';
    case 'video':
      return '🎬';
  }
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType.startsWith('audio/');
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

export const ACCEPTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm'
];

export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg'
];

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
