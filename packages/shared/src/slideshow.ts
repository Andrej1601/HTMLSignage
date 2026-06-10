/**
 * Slideshow domain — placeholder.
 *
 * The detailed `SlideshowConfig` schema currently lives in `./settings` because
 * it ships embedded inside `SettingsSchema` and `EventSettingsOverridesSchema`.
 * When the SlideConfig discriminated-union refactor (#4) lands, the strict
 * variant-aware schemas will move here.
 */

export {
  SlideshowConfigSchema,
  type SlideshowConfigShared,
} from './settings.js';
