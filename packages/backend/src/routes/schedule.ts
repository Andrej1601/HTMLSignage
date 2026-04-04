import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord } from '../lib/versionedEntity.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { broadcastScheduleUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
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
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;
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
    const scheduleToStore = { ...validated };
    const { id, version } = await createVersionedRecord('schedule', scheduleToStore);

    // Broadcast update via WebSocket
    broadcastScheduleUpdate(scheduleToStore);

    await logAuditEvent(req, {
      action: 'schedule.update',
      resource: id,
      details: {
        version,
        presets: Object.keys(validated.presets || {}),
      },
    });

    res.json({
      ok: true,
      version,
      id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation-failed',
        details: error.issues,
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
      where: { id: str(req.params.id) },
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
