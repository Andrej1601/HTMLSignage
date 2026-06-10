/**
 * Schedule-related backend helpers.
 *
 * Pure schedule helpers (`PRESET_KEYS`, `createDefaultSchedule`,
 * `normalizeScheduleData`, etc.) live in `@htmlsignage/shared/schedule`
 * — the single source of truth shared with the frontend.
 *
 * Backend-specific extras (default header copy, default sauna names that
 * the bootstrapping code uses) stay here.
 */
export {
  PRESET_KEYS,
  WEEKDAY_PRESETS,
  SPECIAL_PRESETS,
  DEFAULT_SAUNAS,
  createEmptyDaySchedule,
  createDefaultSchedule,
  normalizeScheduleData,
  copyDaySchedule,
  getTodayPresetKey,
  isValidTime,
  sortTimeRows,
  normalizeSaunaNameKey,
  syncScheduleWithSaunas,
  getActivePresetKey,
  resolveLivePresetKey,
} from '@htmlsignage/shared/schedule';

export const DEFAULT_HEADER = {
  enabled: true,
  showLogo: true,
  logoText: 'HTML Signage',
  showClock: true,
  showDate: true,
  subtitle: 'Premium Wellness & Spa Dashboard',
  height: 8,
};
