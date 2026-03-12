import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { broadcastScheduleUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { normalizeScheduleData, createDefaultSchedule } from '../lib/schedule.js';
import { computeScheduleChangeSummary } from '../lib/scheduleDiff.js';
import type { Schedule } from '../types/schedule.types.js';

const router = Router();

// GET /api/schedule - Get current schedule
router.get('/', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!schedule) {
      return res.json(createDefaultSchedule(1));
    }

    // Always return schedule in current schema to keep frontend stable.
    res.json(normalizeScheduleData(schedule.data));
  } catch (error) {
    console.error('[schedule] Error fetching schedule:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Zeitplan konnte nicht geladen werden' });
  }
});

// GET /api/schedule/history - Get schedule history
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const details = req.query.details === 'true';

    const selectFields: Record<string, boolean> = {
      id: true,
      version: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    };
    if (details) selectFields.data = true;

    const schedules = await prisma.schedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: details ? limit + 1 : limit, // one extra for predecessor diff
      select: selectFields,
    });

    const result = schedules.slice(0, limit).map((entry, i) => {
      const base = {
        id: entry.id,
        version: entry.version,
        isActive: entry.isActive,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
      if (!details) return base;

      const previous = schedules[i + 1];
      return {
        ...base,
        changeSummary: previous
          ? computeScheduleChangeSummary(
              normalizeScheduleData(entry.data) as Schedule,
              normalizeScheduleData(previous.data) as Schedule,
            )
          : null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[schedule] Error fetching history:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Zeitplan konnte nicht geladen werden' });
  }
});

// POST /api/schedule - Save new schedule (auth required)
router.post('/', authMiddleware, requirePermission('schedule:write'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    // Validate request body
    const validated = ScheduleSchema.parse(req.body);

    // Create new schedule
    const newSchedule = await prisma.schedule.create({
      data: {
        version: validated.version,
        data: validated as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    // Deactivate old versions
    await prisma.schedule.updateMany({
      where: {
        id: { not: newSchedule.id },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Broadcast update via WebSocket
    broadcastScheduleUpdate(validated);

    // Log audit event (TODO: implement when auth is ready)
    // await logAuditEvent(userId, 'schedule.update', newSchedule.id);

    res.json({ 
      ok: true, 
      version: validated.version,
      id: newSchedule.id 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation-failed',
        details: error.errors,
      });
    }
    console.error('[schedule] Error saving schedule:', error);
    res.status(500).json({ error: 'save-failed', message: 'Zeitplan konnte nicht gespeichert werden' });
  }
});

// GET /api/schedule/:id - Get specific schedule version
router.get('/:id', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'not-found', message: 'Zeitplan nicht gefunden' });
    }

    res.json(normalizeScheduleData(schedule.data));
  } catch (error) {
    console.error('[schedule] Error fetching schedule:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Zeitplan konnte nicht geladen werden' });
  }
});

export default router;
