import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord, VersionConflictError } from '../lib/versionedEntity.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { broadcastScheduleUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
import { normalizeScheduleData, createDefaultSchedule } from '../lib/schedule.js';
import { computeScheduleChangeSummary } from '../lib/scheduleDiff.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';
import type { Schedule } from '../types/schedule.types.js';

const router = Router();

// GET /api/schedule - Get current schedule
router.get('/', asyncHandler(async (_req, res) => {
  const schedule = await prisma.schedule.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!schedule) {
    return res.json(createDefaultSchedule({ version: 1 }));
  }

  // Always return schedule in current schema to keep frontend stable.
  res.json(normalizeScheduleData(schedule.data));
  return;
}));

// GET /api/schedule/history - Get schedule history
router.get('/history', asyncHandler(async (req, res) => {
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
  return;
}));

// POST /api/schedule - Save new schedule (auth required)
router.post('/', authMiddleware, requirePermission('schedule:write'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  try {
    // Validate request body
    const validated = ScheduleSchema.parse(req.body);
    const scheduleToStore = { ...validated };
    const clientVersion = typeof validated.version === 'number' ? validated.version : null;
    const expectedPreviousVersion = clientVersion !== null ? clientVersion - 1 : undefined;
    const { id, version } = await createVersionedRecord('schedule', scheduleToStore, {
      expectedPreviousVersion,
    });

    invalidateGlobalConfigCache();
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
    return;
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return res.status(409).json({
        error: 'version-conflict',
        message: 'Konflikt: Ein anderer Admin hat den Aufgussplan zwischenzeitlich gespeichert. Bitte Seite neu laden.',
        latestVersion: error.latestVersion,
      });
    }
    // Re-throw everything else (incl. ZodError) so the central error
    // middleware produces the canonical response.
    throw error;
  }
}));

// GET /api/schedule/:id - Get specific schedule version
router.get('/:id', asyncHandler(async (req, res) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id: str(req.params.id) },
  });

  if (!schedule) {
    return res.status(404).json({ error: 'not-found', message: 'Zeitplan nicht gefunden' });
  }

  res.json(normalizeScheduleData(schedule.data));
  return;
}));

export default router;
