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

  if (!activeEvent) {
    return { settings: normalizedBase, activeEvent: null };
  }

  // New model: event references a slideshow by ID (backend resolves to settingsOverrides.slideshow)
  // Legacy model: event has inline settingsOverrides
  const overrides = activeEvent.settingsOverrides;
  const slideshowConfig = overrides?.slideshow;

  // Start with base settings
  let merged = normalizedBase;

  // Apply legacy overrides if present (backward compat)
  if (isPlainRecord(overrides)) {
    merged = deepMergeRecords(
      normalizedBase as unknown as Record<string, unknown>,
      overrides,
    ) as unknown as Settings;
  }

  // Apply design fields from slideshow config (new model: design lives on SlideshowConfig)
  if (slideshowConfig) {
    const sc = slideshowConfig as unknown as Record<string, unknown>;
    if (sc.displayAppearance) merged.displayAppearance = sc.displayAppearance as Settings['displayAppearance'];
    if (sc.designStyle) merged.designStyle = sc.designStyle as Settings['designStyle'];
    if (sc.colorPalette) {
      const palette = sc.colorPalette as ColorPaletteName;
      merged.colorPalette = palette;
      merged.theme = generateDashboardColors({
        ...getColorPalette(palette),
        ...(isPlainRecord(sc.theme) ? (sc.theme as Partial<ThemeColors>) : {}),
      });
    }
  }

  // Apply color palette from legacy overrides
  const overridePalette = typeof overrides?.colorPalette === 'string'
    ? (overrides.colorPalette as ColorPaletteName)
    : undefined;
  if (overridePalette && !slideshowConfig?.colorPalette) {
    merged.colorPalette = overridePalette;
    merged.theme = generateDashboardColors({
      ...getColorPalette(overridePalette),
      ...(isPlainRecord(overrides?.theme) ? (overrides.theme as Partial<ThemeColors>) : {}),
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

    // Resolve event slideshow assets (backend injects config via settingsOverrides.slideshow)
    const eventSlideshow = event.settingsOverrides?.slideshow;
    if (eventSlideshow?.slides) {
      eventSlideshow.slides.forEach((slide) => {
        addMediaIdUrl(urls, mediaItems, slide.mediaId);
      });
    }
  });

  const audioUrl = resolveAudioSourceUrl(settings.audio, mediaItems);
  if (audioUrl) {
    urls.add(audioUrl);
  }

  return Array.from(urls);
}
