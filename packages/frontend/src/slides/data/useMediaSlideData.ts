import { useMemo } from 'react';
import type { MediaImageData, MediaVideoData } from '@htmlsignage/design-sdk';
import type { Media } from '@/types/media.types';
import type { SlideConfig } from '@/types/slideshow.types';
import { getEffectiveMediaFit } from '@/types/slideshow.types';
import { buildUploadUrl } from '@/utils/mediaUrl';

function findMedia(media: Media[] | undefined, mediaId: string | undefined): Media | undefined {
  if (!mediaId || !media) return undefined;
  return media.find((item) => item.id === mediaId);
}

export interface UseMediaImageDataInput {
  slide: SlideConfig;
  media?: Media[];
}

/**
 * Resolve a media-image slide into its headless data shape. Returns `null`
 * when the slide is not a media-image variant or the media cannot be found.
 */
export function useMediaImageData(input: UseMediaImageDataInput): MediaImageData | null {
  const { slide, media } = input;
  return useMemo<MediaImageData | null>(() => {
    if (slide.type !== 'media-image') return null;
    const found = findMedia(media, slide.mediaId);
    if (!found) return null;
    return {
      mediaId: found.id,
      url: buildUploadUrl(found.filename),
      altText: found.originalName,
      fit: getEffectiveMediaFit(slide),
      title: slide.title,
      showTitle: slide.showTitle,
    };
  }, [media, slide]);
}

export interface UseMediaVideoDataInput {
  slide: SlideConfig;
  media?: Media[];
}

/**
 * Resolve a media-video slide into its headless data shape. Returns `null`
 * when the slide is not a media-video variant or the media cannot be found.
 */
export function useMediaVideoData(input: UseMediaVideoDataInput): MediaVideoData | null {
  const { slide, media } = input;
  return useMemo<MediaVideoData | null>(() => {
    if (slide.type !== 'media-video') return null;
    const found = findMedia(media, slide.mediaId);
    if (!found) return null;
    return {
      mediaId: found.id,
      url: buildUploadUrl(found.filename),
      fit: getEffectiveMediaFit(slide),
      playback: slide.videoPlayback ?? 'complete',
      mutedByDefault: true,
      title: slide.title,
      showTitle: slide.showTitle,
    };
  }, [media, slide]);
}
