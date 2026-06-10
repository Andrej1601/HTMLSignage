import { useMemo } from 'react';
import type { InfoPanelData } from '@htmlsignage/design-sdk';
import type { Settings, InfoItem } from '@/types/settings.types';
import type { Media } from '@/types/media.types';
import { getMediaUploadUrl } from '@/utils/mediaUrl';

export interface UseInfoPanelDataInput {
  settings: Settings;
  /** Target info id (from the slide config). Falls back to the first info. */
  infoId: string | undefined;
  media?: Media[];
}

/**
 * Default info shown when `settings.infos` is empty.
 */
const FALLBACK_INFO: InfoItem = {
  id: 'default',
  title: 'Wellness Tipp',
  text: 'Bitte beachten Sie unsere Hinweise für einen angenehmen Aufenthalt.',
};

/**
 * Headless data hook for an info slide. Resolves the selected info item and
 * its associated image into a normalized `InfoPanelData`.
 *
 * Mirrors the selection semantics of the current `InfosSlide` component:
 * if `infoId` matches one in `settings.infos`, use it; otherwise fall back
 * to the first configured info, otherwise a built-in placeholder.
 */
export function useInfoPanelData(input: UseInfoPanelDataInput): InfoPanelData {
  const { settings, infoId, media } = input;

  const info = useMemo<InfoItem>(() => {
    const list = settings.infos ?? [];
    if (infoId) {
      const match = list.find((item) => item.id === infoId);
      if (match) return match;
    }
    return list[0] ?? FALLBACK_INFO;
  }, [settings.infos, infoId]);

  const imageUrl = useMemo(() => {
    if (!info.imageId) return null;
    return getMediaUploadUrl(media, info.imageId) ?? null;
  }, [media, info.imageId]);

  return useMemo<InfoPanelData>(() => {
    // Existing settings.InfoItem.imageMode only has 'thumbnail' | 'background'.
    // Renderers that care about a side-by-side layout map 'thumbnail' → 'side'.
    const mode = !imageUrl
      ? 'none'
      : info.imageMode === 'background'
        ? 'background'
        : 'side';
    return {
      id: info.id,
      title: info.title || 'Info',
      text: info.text || '',
      imageUrl,
      imageMode: mode,
    };
  }, [info, imageUrl]);
}
