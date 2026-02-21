import { isPlainRecord } from './objectUtils';
import type { AudioSettings } from '@/types/settings.types';

/**
 * Normalizes an unknown value into a valid AudioSettings object.
 * Always returns a complete object — missing fields fall back to safe defaults.
 * Use this wherever an AudioSettings is always required (e.g. DisplayClientPage).
 */
export function normalizeAudioSettings(raw: unknown): AudioSettings {
  const value = isPlainRecord(raw) ? raw : {};
  const volume =
    typeof value.volume === 'number' && Number.isFinite(value.volume)
      ? Math.max(0, Math.min(1, value.volume))
      : 0.5;

  return {
    enabled: Boolean(value.enabled),
    src:
      typeof value.src === 'string' && value.src.trim().length > 0
        ? value.src
        : undefined,
    mediaId:
      typeof value.mediaId === 'string' && value.mediaId.trim().length > 0
        ? value.mediaId
        : undefined,
    volume,
    loop: value.loop !== false,
  };
}

/**
 * Parses an unknown value into AudioSettings, or returns null if the value is
 * not a plain object (i.e. no audio override is set).
 * Use this wherever null signals "no override" (e.g. SlideshowPage).
 */
export function parseAudioSettings(raw: unknown): AudioSettings | null {
  if (!isPlainRecord(raw)) return null;
  return normalizeAudioSettings(raw);
}
