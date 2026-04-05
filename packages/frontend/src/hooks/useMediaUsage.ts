import { useMemo } from 'react';
import type { Settings } from '@/types/settings.types';

export interface MediaUsageInfo {
  slides: string[];
  infos: string[];
  events: string[];
  audio: boolean;
  maintenanceScreen: boolean;
}

export function useMediaUsage(settings: Settings | undefined): Map<string, MediaUsageInfo> {
  return useMemo(() => {
    const map = new Map<string, MediaUsageInfo>();

    if (!settings) return map;

    function ensure(id: string): MediaUsageInfo {
      let entry = map.get(id);
      if (!entry) {
        entry = { slides: [], infos: [], events: [], audio: false, maintenanceScreen: false };
        map.set(id, entry);
      }
      return entry;
    }

    // Slides
    if (settings.slideshow?.slides) {
      for (const slide of settings.slideshow.slides) {
        if (slide.mediaId) {
          ensure(slide.mediaId).slides.push(slide.title || slide.type);
        }
      }
    }

    // Audio
    if (settings.audio?.mediaId) {
      ensure(settings.audio.mediaId).audio = true;
    }

    // Infos
    if (settings.infos) {
      for (const info of settings.infos) {
        if (info.imageId) {
          ensure(info.imageId).infos.push(info.title || 'Info');
        }
      }
    }

    // Events
    if (settings.events) {
      for (const event of settings.events) {
        if (event.imageId) {
          ensure(event.imageId).events.push(event.name || 'Event');
        }
      }
    }

    // Maintenance screen
    if (settings.maintenanceScreen?.backgroundImageId) {
      ensure(settings.maintenanceScreen.backgroundImageId).maintenanceScreen = true;
    }

    return map;
  }, [settings]);
}

export function getUsageSummary(usage: MediaUsageInfo | undefined): string[] {
  if (!usage) return [];
  const parts: string[] = [];

  if (usage.slides.length > 0) {
    parts.push(`${usage.slides.length} Slide${usage.slides.length !== 1 ? 's' : ''}`);
  }
  if (usage.events.length > 0) {
    parts.push(`${usage.events.length} Event${usage.events.length !== 1 ? 's' : ''}`);
  }
  if (usage.infos.length > 0) {
    parts.push(`${usage.infos.length} Info${usage.infos.length !== 1 ? 's' : ''}`);
  }
  if (usage.audio) {
    parts.push('Hintergrundmusik');
  }
  if (usage.maintenanceScreen) {
    parts.push('Wartungsbildschirm');
  }

  return parts;
}
