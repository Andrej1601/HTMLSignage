import { z } from 'zod';

// ─── Sub-Schemas (mirroring frontend types) ─────────────────────────────────

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
  clockPosition: z.string().optional(),
}).catchall(z.unknown()).optional();

export const DisplaySettingsSchema = z.object({
  gridColumns: z.number().optional(),
  gridGap: z.number().optional(),
  showBadges: z.boolean().optional(),
  showSubtitles: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  prestartMinutes: z.number().optional(),
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
  /**
   * Optional media id for a brand-image logo. When set, displays render
   * this image instead of the two-tone `logoText`.
   */
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

export const SlideshowConfigSchema = z.object({
  version: z.number().optional(),
  layout: z.string().optional(),
  slides: z.array(z.object({
    id: z.string(),
    type: z.string(),
    enabled: z.boolean(),
    duration: z.number(),
    order: z.number(),
  }).catchall(z.unknown())).optional(),
  defaultDuration: z.number().optional(),
  defaultTransition: z.string().optional(),
  enableTransitions: z.boolean().optional(),
}).catchall(z.unknown()).optional();

export const EventSettingsOverridesSchema = z.object({
  displayAppearance: z.enum(['aurora-thermal', 'wellness-stage', 'editorial-resort', 'mineral-noir']).optional(),
  designStyle: z.enum(['modern-wellness', 'modern-timeline', 'compact-tiles']).optional(),
  colorPalette: z.string().optional(),
  theme: z.record(z.string(), z.string()).optional(),
  fonts: FontsSchema,
  slides: SlideSettingsSchema,
  display: DisplaySettingsSchema,
  header: HeaderSettingsSchema,
  slideshow: SlideshowConfigSchema,
  audio: AudioSettingsSchema,
}).catchall(z.unknown()).optional();

// ─── Main Settings Schema ────────────────────────────────────────────────────

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
  displayAppearance: z.enum(['aurora-thermal', 'wellness-stage', 'editorial-resort', 'mineral-noir']).optional(),
  designStyle: z.enum(['modern-wellness', 'modern-timeline', 'compact-tiles']).optional(),
  colorPalette: z.string().optional(),
  slideshow: SlideshowConfigSchema,
  infos: z.array(InfoItemSchema).optional(),
  aromas: z.array(z.object({
    id: z.string(),
    emoji: z.string(),
    name: z.string(),
  })).optional(),
  events: z.array(z.object({
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
    settingsOverrides: EventSettingsOverridesSchema,
  }).catchall(z.unknown())).optional(),
}).catchall(z.unknown());
