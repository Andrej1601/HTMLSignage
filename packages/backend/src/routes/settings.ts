import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

// ─── Sub-Schemas (mirroring frontend types in settings.types.ts) ─────────────

const FontsSchema = z.object({
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
}).passthrough().optional();

const SlideSettingsSchema = z.object({
  defaultDuration: z.number().optional(),
  transitionDuration: z.number().optional(),
  showClock: z.boolean().optional(),
  clockPosition: z.string().optional(),
}).passthrough().optional();

const DisplaySettingsSchema = z.object({
  gridColumns: z.number().optional(),
  gridGap: z.number().optional(),
  showBadges: z.boolean().optional(),
  showSubtitles: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  prestartMinutes: z.number().optional(),
}).passthrough().optional();

const AudioSettingsSchema = z.object({
  enabled: z.boolean(),
  src: z.string().optional(),
  mediaId: z.string().optional(),
  volume: z.number(),
  loop: z.boolean(),
}).passthrough().optional();

const HeaderSettingsSchema = z.object({
  enabled: z.boolean(),
  showLogo: z.boolean(),
  logoText: z.string().optional(),
  showClock: z.boolean(),
  showDate: z.boolean(),
  subtitle: z.string().optional(),
  height: z.number().optional(),
}).passthrough().optional();

const SaunaInfoSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  capacity: z.number().optional(),
  features: z.array(z.string()).optional(),
}).passthrough().optional();

const SaunaSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['active', 'no-aufguss', 'out-of-order', 'hidden']),
  order: z.number(),
  imageId: z.string().optional(),
  color: z.string().optional(),
  info: SaunaInfoSchema,
  description: z.string().optional(),
}).passthrough();

const InfoItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  imageId: z.string().optional(),
  imageMode: z.enum(['thumbnail', 'background']).optional(),
}).passthrough();

const SlideshowConfigSchema = z.object({
  version: z.number().optional(),
  layout: z.string().optional(),
  slides: z.array(z.object({
    id: z.string(),
    type: z.string(),
    enabled: z.boolean(),
    duration: z.number(),
    order: z.number(),
  }).passthrough()).optional(),
  defaultDuration: z.number().optional(),
  defaultTransition: z.string().optional(),
  enableTransitions: z.boolean().optional(),
}).passthrough().optional();

const EventSettingsOverridesSchema = z.object({
  designStyle: z.enum(['modern-wellness', 'modern-timeline', 'compact-tiles']).optional(),
  colorPalette: z.string().optional(),
  theme: z.record(z.string(), z.string()).optional(),
  fonts: FontsSchema,
  slides: SlideSettingsSchema,
  display: DisplaySettingsSchema,
  header: HeaderSettingsSchema,
  slideshow: SlideshowConfigSchema,
  audio: AudioSettingsSchema,
}).passthrough().optional();

// ─── Main Settings Schema ────────────────────────────────────────────────────

const SettingsSchema = z.object({
  version: z.number().int().positive(),
  theme: z.record(z.string(), z.string()).optional(),
  fonts: FontsSchema,
  slides: SlideSettingsSchema,
  display: DisplaySettingsSchema,
  audio: AudioSettingsSchema,
  header: HeaderSettingsSchema,
  saunas: z.array(SaunaSchema).optional(),
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
  }).passthrough()).optional(),
}).passthrough();

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!settings) {
      return res.json({ version: 1 });
    }

    // Create a copy of settings data and add header defaults if missing
    const data = { ...(settings.data as Record<string, unknown>) };
    if (!data.header) {
      data.header = {
        enabled: true,
        showLogo: true,
        logoText: 'HTML Signage',
        showClock: true,
        showDate: true,
        subtitle: 'Premium Wellness & Spa Dashboard',
        height: 8,
      };
      console.log('[settings] Added default header configuration');
    }

    res.json(data);
  } catch (error) {
    console.error('[settings] Error fetching:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Einstellungen konnten nicht geladen werden' });
  }
});

// POST /api/settings (auth required)
router.post('/', authMiddleware, requirePermission('settings:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = SettingsSchema.parse(req.body);
    const latest = await prisma.settings.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    const settingsToStore = {
      ...validated,
      version: nextVersion,
    };

    const newSettings = await prisma.settings.create({
      data: {
        version: nextVersion,
        data: settingsToStore as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    await prisma.settings.updateMany({
      where: {
        id: { not: newSettings.id },
        isActive: true,
      },
      data: { isActive: false },
    });

    broadcastSettingsUpdate(settingsToStore);
    await logAuditEvent(req, {
      action: 'settings.update',
      resource: newSettings.id,
      details: {
        version: nextVersion,
        designStyle: validated.designStyle || null,
        eventCount: validated.events?.length || 0,
        infoCount: validated.infos?.length || 0,
      },
    });

    res.json({ ok: true, version: nextVersion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[settings] Error saving:', error);
    res.status(500).json({ error: 'save-failed', message: 'Einstellungen konnten nicht gespeichert werden' });
  }
});

export default router;
