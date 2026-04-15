import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const CreateSlideshowSchema = z.object({
  name: z.string().min(1).max(255),
  copyFromId: z.string().optional(),
});

const UpdateSlideshowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

async function ensureDefaultSlideshow() {
  const existing = await prisma.slideshow.findFirst({
    where: { isDefault: true },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const activeSettings = await prisma.settings.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
    select: { data: true },
  });

  const settingsData = (activeSettings?.data ?? {}) as Record<string, unknown>;
  const slideshowConfig = (settingsData.slideshow ?? {}) as Prisma.InputJsonValue;

  return prisma.slideshow.create({
    data: {
      name: 'Standard',
      isDefault: true,
      config: slideshowConfig,
    },
    select: { id: true },
  });
}

// ─── GET /api/slideshows - List all slideshows ──────────────────────────────

router.get('/', authMiddleware, requirePermission('slideshow:manage'), async (req: AuthRequest, res) => {
  try {
    await ensureDefaultSlideshow();

    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 200;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const [slideshows, totalCount] = await Promise.all([
      prisma.slideshow.findMany({
        include: {
          devices: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.slideshow.count(),
    ]);

    const result = slideshows.map(({ devices, ...rest }) => ({
      ...rest,
      assignedDevices: devices,
      deviceCount: devices.length,
    }));

    res.setHeader('X-Total-Count', String(totalCount));
    res.json(result);
  } catch (error) {
    console.error('[slideshows] Error listing:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Slideshows konnten nicht geladen werden' });
  }
});

// ─── GET /api/slideshows/:id - Get single slideshow ─────────────────────────

router.get('/:id', authMiddleware, requirePermission('slideshow:manage'), async (req: AuthRequest, res) => {
  try {
    const slideshow = await prisma.slideshow.findUnique({
      where: { id: str(req.params.id) },
      include: {
        devices: {
          select: { id: true, name: true },
        },
      },
    });

    if (!slideshow) {
      return res.status(404).json({ error: 'not-found', message: 'Slideshow nicht gefunden' });
    }

    const { devices, ...rest } = slideshow;
    res.json({
      ...rest,
      assignedDevices: devices,
      deviceCount: devices.length,
    });
  } catch (error) {
    console.error('[slideshows] Error fetching slideshow:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Slideshow konnte nicht geladen werden' });
  }
});

// ─── POST /api/slideshows - Create slideshow ────────────────────────────────

router.post('/', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = CreateSlideshowSchema.parse(req.body);

    let config: Prisma.InputJsonValue = {};

    // Optionally copy config from an existing slideshow
    if (validated.copyFromId) {
      const source = await prisma.slideshow.findUnique({
        where: { id: validated.copyFromId },
        select: { config: true },
      });

      if (!source) {
        return res.status(404).json({ error: 'source-not-found', message: 'Quell-Slideshow nicht gefunden' });
      }

      config = source.config as Prisma.InputJsonValue;
    }

    const slideshow = await prisma.slideshow.create({
      data: {
        name: validated.name,
        config,
      },
      include: {
        devices: {
          select: { id: true, name: true },
        },
      },
    });

    await logAuditEvent(req, {
      action: 'slideshow.create',
      resource: slideshow.id,
      details: {
        name: slideshow.name,
        copiedFrom: validated.copyFromId ?? null,
      },
    });

    const { devices: createdDevices, ...createdRest } = slideshow;
    res.json({ ...createdRest, assignedDevices: createdDevices, deviceCount: createdDevices.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[slideshows] Error creating slideshow:', error);
    res.status(500).json({ error: 'create-failed', message: 'Slideshow konnte nicht erstellt werden' });
  }
});

// ─── PATCH /api/slideshows/:id - Update slideshow ───────────────────────────

router.patch('/:id', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = UpdateSlideshowSchema.parse(req.body);

    const existing = await prisma.slideshow.findUnique({
      where: { id: str(req.params.id) },
      select: { id: true, name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not-found', message: 'Slideshow nicht gefunden' });
    }

    const data: Prisma.SlideshowUpdateInput = {};
    if (validated.name !== undefined) {
      data.name = validated.name;
    }
    if (validated.config !== undefined) {
      data.config = validated.config as Prisma.InputJsonValue;
    }

    const slideshow = await prisma.slideshow.update({
      where: { id: str(req.params.id) },
      data,
      include: {
        devices: {
          select: { id: true, name: true },
        },
      },
    });

    await logAuditEvent(req, {
      action: 'slideshow.update',
      resource: slideshow.id,
      details: {
        name: validated.name ?? null,
        configUpdated: validated.config !== undefined,
      },
    });

    const { devices: updatedDevices, ...updatedRest } = slideshow;
    res.json({ ...updatedRest, assignedDevices: updatedDevices, deviceCount: updatedDevices.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[slideshows] Error updating slideshow:', error);
    res.status(500).json({ error: 'update-failed', message: 'Slideshow konnte nicht aktualisiert werden' });
  }
});

// ─── DELETE /api/slideshows/:id - Delete slideshow ──────────────────────────

router.delete('/:id', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.slideshow.findUnique({
      where: { id: str(req.params.id) },
      select: { id: true, name: true, isDefault: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not-found', message: 'Slideshow nicht gefunden' });
    }

    if (existing.isDefault) {
      return res.status(400).json({ error: 'cannot-delete-default', message: 'Standard-Slideshow kann nicht gelöscht werden' });
    }

    // Reassign devices that reference this slideshow to null
    await prisma.device.updateMany({
      where: { slideshowId: str(req.params.id) },
      data: { slideshowId: null },
    });

    await prisma.slideshow.delete({ where: { id: str(req.params.id) } });

    await logAuditEvent(req, {
      action: 'slideshow.delete',
      resource: str(req.params.id),
      details: { name: existing.name },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[slideshows] Error deleting slideshow:', error);
    res.status(500).json({ error: 'delete-failed', message: 'Slideshow konnte nicht gelöscht werden' });
  }
});

export default router;
