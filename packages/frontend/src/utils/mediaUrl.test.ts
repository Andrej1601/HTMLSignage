import { describe, it, expect } from 'vitest';
import { findMediaById, getMediaUploadUrl } from './mediaUrl';
import type { Media } from '@/types/media.types';

const mockMedia: Media[] = [
  { id: 'm1', filename: 'image1.jpg', originalName: 'photo.jpg', mimeType: 'image/jpeg', size: 1024, type: 'image', url: '/uploads/image1.jpg', createdAt: '', updatedAt: '' },
  { id: 'm2', filename: 'video1.mp4', originalName: 'clip.mp4', mimeType: 'video/mp4', size: 2048, type: 'video', url: '/uploads/video1.mp4', createdAt: '', updatedAt: '' },
];

describe('findMediaById', () => {
  it('finds existing media', () => {
    expect(findMediaById(mockMedia, 'm1')).toBe(mockMedia[0]);
  });

  it('returns undefined for unknown id', () => {
    expect(findMediaById(mockMedia, 'unknown')).toBeUndefined();
  });

  it('returns undefined when media array is undefined', () => {
    expect(findMediaById(undefined, 'm1')).toBeUndefined();
  });

  it('returns undefined when mediaId is undefined', () => {
    expect(findMediaById(mockMedia, undefined)).toBeUndefined();
  });
});

describe('getMediaUploadUrl', () => {
  it('returns upload url for existing media', () => {
    const url = getMediaUploadUrl(mockMedia, 'm1');
    expect(url).toContain('/uploads/image1.jpg');
  });

  it('returns null for unknown media', () => {
    expect(getMediaUploadUrl(mockMedia, 'unknown')).toBeNull();
  });

  it('returns null when media array is undefined', () => {
    expect(getMediaUploadUrl(undefined, 'm1')).toBeNull();
  });
});
