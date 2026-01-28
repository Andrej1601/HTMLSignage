import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { broadcastScheduleUpdate } from '../websocket/index.js';

const router = Router();

// GET /api/schedule - Get current schedule
router.get('/', async (req, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!schedule) {
      return res.json({ version: 1, rows: [] });
    }

    res.json(schedule.data);
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

    res.json(schedule.data);
  } catch (error) {
    console.error('[schedule] Error fetching schedule:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

export default router;
