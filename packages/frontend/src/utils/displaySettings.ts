import type { Device } from '@/types/device.types';
import type { Media } from '@/types/media.types';
import {
  generateDashboardColors,
  getActiveEvent,
  getColorPalette,
  getDefaultSettings,
  type ColorPaletteName,
  type Event,
  type Settings,
  type ThemeColors,
} from '@/types/settings.types';
import { findMediaById, buildUploadUrl, toAbsoluteMediaUrl } from '@/utils/mediaUrl';
import { getDeviceOverrideSettings } from '@/utils/deviceUtils';
import { normalizeAudioSettings } from '@/utils/audioUtils';
import { deepMergeRecords, isPlainRecord } from '@/utils/objectUtils';
import { migrateSettings } from '@/utils/slideshowMigration';

function isSlideshowLike(value: unknown): boolean {
  return isPlainRecord(value) && Array.isArray((value as { slides?: unknown }).slides);
}

export function applyActiveEventSettings(
  baseSettings: Settings | undefined,
  now: Date = new Date(),
  deviceId?: string | null,
): { settings: Settings; activeEvent: Event | null } {
  const normalizedBase = migrateSettings(baseSettings || getDefaultSettings());
  const activeEvent = getActiveEvent(normalizedBase, now, deviceId);
  const overrides = activeEvent?.settingsOverrides;

  if (!isPlainRecord(overrides)) {
    return {
      settings: normalizedBase,
      activeEvent,
    };
  }

  const merged = deepMergeRecords(
    normalizedBase as unknown as Record<string, unknown>,
    overrides,
  ) as unknown as Settings;

  const overridePalette =
    typeof overrides.colorPalette === 'string'
      ? (overrides.colorPalette as ColorPaletteName)
      : undefined;

  if (overridePalette) {
    const paletteTheme = generateDashboardColors(getColorPalette(overridePalette));
    const overrideTheme = isPlainRecord(overrides.theme)
      ? (overrides.theme as Partial<ThemeColors>)
      : undefined;

    merged.colorPalette = overridePalette;
    merged.theme = generateDashboardColors({
      ...paletteTheme,
      ...(overrideTheme || {}),
    });
  }

  return {
    settings: migrateSettings(merged),
    activeEvent,
  };
}

export function resolveEffectiveDeviceSettings(
  globalSettings: Settings | undefined,
  device?: Device | null,
  now: Date = new Date(),
): {
  settings: Settings;
  activeEvent: Event | null;
  hasOverrideSettings: boolean;
  hasOverrideSlideshow: boolean;
} {
  const normalizedGlobal = migrateSettings(globalSettings || getDefaultSettings());
  const overrideSettings = getDeviceOverrideSettings(device ?? null);
  const hasOverrideSettings = Object.keys(overrideSettings).length > 0;
  const hasOverrideSlideshow = isSlideshowLike(overrideSettings.slideshow);

  const baseSettings = device?.mode === 'override' && hasOverrideSettings
    ? migrateSettings(
        deepMergeRecords(
          normalizedGlobal as unknown as Record<string, unknown>,
          overrideSettings,
        ) as unknown as Settings,
      )
    : normalizedGlobal;

  const { settings, activeEvent } = applyActiveEventSettings(baseSettings, now, device?.id);

  return {
    settings,
    activeEvent,
    hasOverrideSettings,
    hasOverrideSlideshow,
  };
}

export function resolveAudioSourceUrl(rawAudio: unknown, media?: Media[]): string {
  const audio = normalizeAudioSettings(rawAudio);
  if (!audio.enabled) return '';

  if (audio.mediaId) {
    const mediaItem = findMediaById(media, audio.mediaId);
    if (mediaItem) {
      return buildUploadUrl(mediaItem.filename);
    }
  }

  return audio.src ? toAbsoluteMediaUrl(audio.src) : '';
}

function addMediaIdUrl(urls: Set<string>, media: Media[] | undefined, mediaId?: string): void {
  if (!mediaId) return;
  const mediaItem = findMediaById(media, mediaId);
  if (!mediaItem) return;
  urls.add(buildUploadUrl(mediaItem.filename));
}

export function collectDisplayAssetUrls(settings: Settings | undefined, media?: Media[]): string[] {
  if (!settings) return [];

  const urls = new Set<string>();
  const mediaItems = media || [];

  settings.slideshow?.slides?.forEach((slide) => {
    addMediaIdUrl(urls, mediaItems, slide.mediaId);
  });

  settings.infos?.forEach((info) => {
    addMediaIdUrl(urls, mediaItems, info.imageId);
  });

  settings.saunas?.forEach((sauna) => {
    addMediaIdUrl(urls, mediaItems, sauna.imageId);
  });

  settings.events?.forEach((event) => {
    addMediaIdUrl(urls, mediaItems, event.imageId);

    if (event.settingsOverrides?.slideshow) {
      event.settingsOverrides.slideshow.slides?.forEach((slide) => {
        addMediaIdUrl(urls, mediaItems, slide.mediaId);
      });
    }

    const eventAudioUrl = resolveAudioSourceUrl(event.settingsOverrides?.audio, mediaItems);
    if (eventAudioUrl) {
      urls.add(eventAudioUrl);
    }
  });

  const audioUrl = resolveAudioSourceUrl(settings.audio, mediaItems);
  if (audioUrl) {
    urls.add(audioUrl);
  }

  return Array.from(urls);
}
