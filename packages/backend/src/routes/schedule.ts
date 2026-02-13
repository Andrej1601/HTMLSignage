import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ScheduleSchema, type DaySchedule, type PresetKey, type Schedule } from '../types/schedule.types.js';
import { broadcastScheduleUpdate } from '../websocket/index.js';

const router = Router();
const PRESET_KEYS: PresetKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2'];
const DEFAULT_SAUNAS = ['Vulkan', 'Nordisch', 'Bio'];

function createEmptyDaySchedule(saunas: string[] = DEFAULT_SAUNAS): DaySchedule {
  return {
    saunas: [...saunas],
    rows: [],
  };
}

function createDefaultSchedule(version = 1): Schedule {
  const presets = Object.fromEntries(
    PRESET_KEYS.map((key) => [key, createEmptyDaySchedule()])
  ) as Record<PresetKey, DaySchedule>;

  return {
    version: Math.max(1, Math.floor(version)),
    presets,
    autoPlay: false,
  };
}

function normalizeScheduleData(raw: unknown): Schedule {
  const parsed = ScheduleSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const maybeVersion = (raw as { version?: unknown } | null)?.version;
  const version = typeof maybeVersion === 'number' && Number.isFinite(maybeVersion) ? maybeVersion : 1;
  return createDefaultSchedule(version);
}

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
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// GET /api/schedule/history - Get schedule history
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    const schedules = await prisma.schedule.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        version: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(schedules);
  } catch (error) {
    console.error('[schedule] Error fetching history:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// POST /api/schedule - Save new schedule
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const validated = ScheduleSchema.parse(req.body);

    // Create new schedule
    const newSchedule = await prisma.schedule.create({
      data: {
        version: validated.version,
        data: validated as any,
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
    res.status(500).json({ error: 'save-failed' });
  }
});

// GET /api/schedule/:id - Get specific schedule version
router.get('/:id', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'not-found' });
    }

    res.json(normalizeScheduleData(schedule.data));
  } catch (error) {
    console.error('[schedule] Error fetching schedule:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

export default router;
