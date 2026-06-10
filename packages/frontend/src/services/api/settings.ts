import type { Settings } from '@/types/settings.types';
import { SettingsSchema } from '@htmlsignage/shared/settings';
import { api } from './core';
import type { SaveVersionedResponse } from './types';

/**
 * Strip legacy fields from settings before persistence.
 *
 * - `displayAppearance` was the old "Bühne"-Konzept; the renderer now
 *   chooses everything via `display.designPackId`. Older records often
 *   carry `'mineral-noir'`/`'editorial-resort'` etc. — reset to the
 *   production default (`'aurora-thermal'`) on every save so stale
 *   values don't surprise future operators or migration scripts.
 * - `display.useDesignPacks` is no longer read; force-true so a downgrade
 *   to an older client (which still consults the flag) keeps working.
 * - `slideshow` was the old "globale Slideshow" — a copy of the slideshow
 *   stored as JSON inside settings, parallel to the canonical
 *   `slideshows` table. The display now resolves slideshows exclusively
 *   via the DB (Standard-Slideshow with `isDefault: true` or the device-
 *   specific assignment); writing the JSON copy back would only desync
 *   the two and confuse the slideshow editor. Strip on save.
 */
function normalizeForSave(settings: Settings): Settings {
  const next: Settings = {
    ...settings,
    displayAppearance: 'aurora-thermal',
    display: {
      ...settings.display,
      useDesignPacks: true,
    },
  };
  delete (next as { slideshow?: unknown }).slideshow;
  return next;
}

export const settingsApi = {
  getSettings: async (): Promise<Settings> => {
    const { data } = await api.get<unknown>('/settings');
    const parsed = SettingsSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('[settingsApi] Invalid settings payload:', parsed.error.issues);
    }
    return data as Settings;
  },

  saveSettings: async (settings: Settings): Promise<SaveVersionedResponse> => {
    const { data } = await api.post<SaveVersionedResponse>('/settings', normalizeForSave(settings));
    return data;
  },
};
