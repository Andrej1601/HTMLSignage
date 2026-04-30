import { z } from 'zod';

/**
 * Settings domain — schema-first source of truth.
 * Migrated from `packages/backend/src/types/settings.types.ts`.
 *
 * NOTE: `.catchall(z.unknown())` is preserved during the relocate phase
 * to avoid rejecting existing live records. A later tightening pass should
 * remove `catchall` once all FE-only fields are explicit.
 */

// ─── Atomic Unions ──────────────────────────────────────────────────────────

export const ClockPositionSchema = z.enum([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]);
export type ClockPosition = z.infer<typeof ClockPositionSchema>;

export const SlideTypeSchema = z.enum([
  'content-panel',
  'sauna-detail',
  'media-image',
  'media-video',
  'infos',
  'events',
]);
export type SlideType = z.infer<typeof SlideTypeSchema>;

export const LayoutTypeSchema = z.enum([
  'split-view',
  'full-rotation',
  'triple-view',
  'grid-2x2',
]);
export type LayoutType = z.infer<typeof LayoutTypeSchema>;

export const VideoPlaybackModeSchema = z.enum([
  'duration',
  'complete',
  'loop-duration',
]);
export type VideoPlaybackMode = z.infer<typeof VideoPlaybackModeSchema>;

export const MediaFitModeSchema = z.enum(['cover', 'contain']);
export type MediaFitMode = z.infer<typeof MediaFitModeSchema>;

export const TransitionTypeSchema = z.enum(['fade', 'slide', 'zoom', 'none']);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const DisplayAppearanceSchema = z.enum([
  'aurora-thermal',
  'wellness-stage',
  'editorial-resort',
  'mineral-noir',
]);
export type DisplayAppearance = z.infer<typeof DisplayAppearanceSchema>;

export const DesignStyleSchema = z.enum([
  'modern-wellness',
  'modern-timeline',
  'compact-tiles',
]);
export type DesignStyle = z.infer<typeof DesignStyleSchema>;

export const SaunaDetailStyleSchema = z.enum(['split', 'hero', 'portrait']);
export type SaunaDetailStyle = z.infer<typeof SaunaDetailStyleSchema>;

// ─── Sub-Schemas ────────────────────────────────────────────────────────────

export const FontsSchema = z.object({
  fontScale: z.number().optional(),
  h1Scale: z.number().optional(),
  h2Scale: z.number().optional(),
  overviewTitleScale: z.number().optional(),
  overviewHeadScale: z.number().optional(),
  overviewCellScale: z.number().optional(),
  overviewTimeScale: z.number().optional(),
  overviewTimeWidthScale: z.number().optional(),
  tileTextScale: z.number().optional(),
  tileTimeScale: z.number().optional(),
  tileTimeWeight: z.number().optional(),
  metaTextScale: z.number().optional(),
  metaHeadScale: z.number().optional(),
  badgeTextScale: z.number().optional(),
  flameScale: z.number().optional(),
}).catchall(z.unknown()).optional();

export const SlideSettingsSchema = z.object({
  defaultDuration: z.number().optional(),
  transitionDuration: z.number().optional(),
  showClock: z.boolean().optional(),
  clockPosition: ClockPositionSchema.optional(),
}).catchall(z.unknown()).optional();

export const DisplaySettingsSchema = z.object({
  gridColumns: z.number().optional(),
  gridGap: z.number().optional(),
  showBadges: z.boolean().optional(),
  showSubtitles: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  prestartMinutes: z.number().optional(),
  useDesignPacks: z.boolean().optional(),
  designPackId: z.string().optional(),
  intensityDisplay: z.enum(['flames', 'roman']).optional(),
  accentStripes: z.boolean().optional(),
  heroOverlayIntensity: z.number().optional(),
}).catchall(z.unknown()).optional();

export const AudioSettingsSchema = z.object({
  enabled: z.boolean(),
  src: z.string().optional(),
  mediaId: z.string().optional(),
  volume: z.number(),
  loop: z.boolean(),
}).catchall(z.unknown()).optional();

export const HeaderSettingsSchema = z.object({
  enabled: z.boolean(),
  showLogo: z.boolean(),
  logoText: z.string().optional(),
  logoImageId: z.string().optional(),
  showClock: z.boolean(),
  showDate: z.boolean(),
  subtitle: z.string().optional(),
  height: z.number().optional(),
}).catchall(z.unknown()).optional();

export const MaintenanceScreenSchema = z.object({
  label: z.string().optional(),
  headline: z.string().optional(),
  message: z.string().optional(),
  showDeviceName: z.boolean().optional(),
  backgroundImageId: z.string().optional(),
  displayStyle: z.enum(['glass', 'overlay']).optional(),
}).catchall(z.unknown()).optional();

export const SaunaInfoSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  capacity: z.number().optional(),
  features: z.array(z.string()).optional(),
}).catchall(z.unknown()).optional();

export const SaunaSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'no-aufguss', 'out-of-order', 'hidden']),
  order: z.number(),
  imageId: z.string().optional(),
  color: z.string().optional(),
  info: SaunaInfoSchema,
  description: z.string().optional(),
}).catchall(z.unknown());

export const InfoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  imageId: z.string().optional(),
  imageMode: z.enum(['thumbnail', 'background']).optional(),
}).catchall(z.unknown());

// ─── Slide Discriminated Union ──────────────────────────────────────────────
//
// Variant-specific fields are required on the matching variant only:
//   sauna-detail  → saunaId required
//   media-image   → mediaId required
//   media-video   → mediaId required
//   infos         → infoId optional (omit = "all infos" mode)
//   content-panel, events → no extra required fields
//
// Default `strip` mode — unknown extras are silently dropped during parse.
// This keeps inferred types clean (no `[x: string]: unknown` index sig that
// poisons `Omit<SlideConfig, 'id'>` and friends in consumers).

const SlideBaseFields = {
  id: z.string(),
  enabled: z.boolean(),
  duration: z.number(),
  order: z.number(),
  zoneId: z.string().optional(),
  title: z.string().optional(),
  showTitle: z.boolean().optional(),
  transition: TransitionTypeSchema.optional(),
  customCss: z.string().optional(),
  notes: z.string().optional(),
} as const;

export const ContentPanelSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('content-panel'),
});

export const SaunaDetailSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('sauna-detail'),
  saunaId: z.string(),
});

export const MediaImageSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('media-image'),
  mediaId: z.string(),
  mediaFit: MediaFitModeSchema.optional(),
});

export const MediaVideoSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('media-video'),
  mediaId: z.string(),
  videoPlayback: VideoPlaybackModeSchema.optional(),
  mediaFit: MediaFitModeSchema.optional(),
});

export const InfosSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('infos'),
  infoId: z.string().optional(),
});

export const EventsSlideSchema = z.object({
  ...SlideBaseFields,
  type: z.literal('events'),
});

export const SlideConfigSchema = z.discriminatedUnion('type', [
  ContentPanelSlideSchema,
  SaunaDetailSlideSchema,
  MediaImageSlideSchema,
  MediaVideoSlideSchema,
  InfosSlideSchema,
  EventsSlideSchema,
]);

// Inferred per-variant types — handy for narrowing in consumers.
export type ContentPanelSlide = z.infer<typeof ContentPanelSlideSchema>;
export type SaunaDetailSlide = z.infer<typeof SaunaDetailSlideSchema>;
export type MediaImageSlide = z.infer<typeof MediaImageSlideSchema>;
export type MediaVideoSlide = z.infer<typeof MediaVideoSlideSchema>;
export type InfosSlide = z.infer<typeof InfosSlideSchema>;
export type EventsSlide = z.infer<typeof EventsSlideSchema>;

export const SlideshowConfigSchema = z.object({
  version: z.number().optional(),
  layout: LayoutTypeSchema.optional(),
  slides: z.array(SlideConfigSchema).optional(),
  defaultDuration: z.number().optional(),
  defaultTransition: TransitionTypeSchema.optional(),
  enableTransitions: z.boolean().optional(),
  persistentZonePosition: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  persistentZoneSize: z.number().optional(),
  displayAppearance: DisplayAppearanceSchema.optional(),
  designStyle: DesignStyleSchema.optional(),
  saunaDetailStyle: SaunaDetailStyleSchema.optional(),
  colorPalette: z.string().optional(),
  /**
   * Per-slideshow design-pack override. When set, this pack is used for
   * the slideshow regardless of the global `display.designPackId`.
   * Allows different slideshows (e.g. event vs. standard) to use
   * completely different visual identities without per-device hacks.
   */
  designPackId: z.string().optional(),
  pauseOnInteraction: z.boolean().optional(),
  showSlideIndicators: z.boolean().optional(),
  showZoneBorders: z.boolean().optional(),
}).catchall(z.unknown()).optional();

export const EventSettingsOverridesSchema = z.object({
  displayAppearance: DisplayAppearanceSchema.optional(),
  designStyle: DesignStyleSchema.optional(),
  colorPalette: z.string().optional(),
  theme: z.record(z.string(), z.string()).optional(),
  fonts: FontsSchema,
  slides: SlideSettingsSchema,
  display: DisplaySettingsSchema,
  header: HeaderSettingsSchema,
  slideshow: SlideshowConfigSchema,
  audio: AudioSettingsSchema,
}).catchall(z.unknown()).optional();

export const AromaSchema = z.object({
  id: z.string(),
  emoji: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

export const EventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  imageId: z.string().optional(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string().optional(),
  endTime: z.string().optional(),
  assignedPreset: z.enum(['Evt1', 'Evt2']),
  isActive: z.boolean(),
  targetDeviceIds: z.array(z.string()).optional(),
  slideshowId: z.string().optional(),
  /** @deprecated Use slideshowId. Kept for backward compat with existing events. */
  settingsOverrides: EventSettingsOverridesSchema,
}).catchall(z.unknown());

// ─── Main Settings Schema ───────────────────────────────────────────────────

export const SettingsSchema = z.object({
  version: z.number().int().positive(),
  theme: z.record(z.string(), z.string()).optional(),
  fonts: FontsSchema,
  slides: SlideSettingsSchema,
  display: DisplaySettingsSchema,
  audio: AudioSettingsSchema,
  header: HeaderSettingsSchema,
  maintenanceScreen: MaintenanceScreenSchema,
  saunas: z.array(SaunaSchema).optional(),
  displayAppearance: DisplayAppearanceSchema.optional(),
  designStyle: DesignStyleSchema.optional(),
  saunaDetailStyle: SaunaDetailStyleSchema.optional(),
  colorPalette: z.string().optional(),
  slideshow: SlideshowConfigSchema,
  infos: z.array(InfoItemSchema).optional(),
  aromas: z.array(AromaSchema).optional(),
  events: z.array(EventSchema).optional(),
}).catchall(z.unknown());

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type Fonts = z.infer<typeof FontsSchema>;
export type SlideSettings = z.infer<typeof SlideSettingsSchema>;
export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export type HeaderSettings = z.infer<typeof HeaderSettingsSchema>;
export type MaintenanceScreen = z.infer<typeof MaintenanceScreenSchema>;
export type SaunaInfo = z.infer<typeof SaunaInfoSchema>;
export type Sauna = z.infer<typeof SaunaSchema>;
export type InfoItem = z.infer<typeof InfoItemSchema>;
export type SlideConfigShared = z.infer<typeof SlideConfigSchema>;
export type SlideshowConfigShared = z.infer<typeof SlideshowConfigSchema>;
export type EventSettingsOverrides = z.infer<typeof EventSettingsOverridesSchema>;
export type Aroma = z.infer<typeof AromaSchema>;
export type EventEntry = z.infer<typeof EventSchema>;
export type SettingsShared = z.infer<typeof SettingsSchema>;

// ─── Pure Event Helpers ─────────────────────────────────────────────────────

/**
 * Minimal event shape the helpers actually read. Both FE `Event` and
 * shared `EventEntry` are structurally assignable to this — keeps the
 * helpers usable across packages without forcing strict equality.
 */
type EventLike = {
  isActive: boolean;
  startDate: string;
  startTime: string;
  endDate?: string | undefined;
  endTime?: string | undefined;
  targetDeviceIds?: string[] | undefined;
  assignedPreset: 'Evt1' | 'Evt2';
};

/** True when `now` lies within the event window. Honours `isActive`. */
export function isEventActive<T extends EventLike>(event: T, now: Date = new Date()): boolean {
  if (!event.isActive) return false;
  const startDateTime = new Date(`${event.startDate}T${event.startTime}`);
  const endDate = event.endDate || event.startDate;
  const endTime = event.endTime || '23:59';
  const endDateTime = new Date(`${endDate}T${endTime}`);
  return now >= startDateTime && now <= endDateTime;
}

/**
 * True when the event applies to the given device. Events with no
 * `targetDeviceIds` apply to every device. When `deviceId` is missing
 * we likewise consider the event applicable so previews/admin views
 * see the event.
 */
export function eventTargetsDevice<T extends EventLike>(event: T, deviceId?: string | null): boolean {
  const targets = Array.isArray(event.targetDeviceIds)
    ? event.targetDeviceIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (targets.length === 0) return true;
  if (!deviceId) return true;
  return targets.includes(deviceId);
}

/** Returns the most recently-started active event for the device, or null. */
export function getActiveEvent<T extends EventLike>(
  settings: { events?: T[] | undefined } | null | undefined,
  now: Date = new Date(),
  deviceId?: string | null,
): T | null {
  if (!settings?.events) return null;
  const activeEvents = settings.events
    .filter((event) => isEventActive(event, now) && eventTargetsDevice(event, deviceId))
    .sort((a, b) => {
      const aStart = new Date(`${a.startDate}T${a.startTime}`);
      const bStart = new Date(`${b.startDate}T${b.startTime}`);
      return bStart.getTime() - aStart.getTime();
    });
  return activeEvents[0] ?? null;
}
