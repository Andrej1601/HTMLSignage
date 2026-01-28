import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';

const router = Router();

const SettingsSchema = z.object({
  version: z.number().int().positive(),
  theme: z.record(z.string()).optional(),
  fonts: z.record(z.any()).optional(),
  slides: z.record(z.any()).optional(),
  display: z.record(z.any()).optional(),
  audio: z.record(z.any()).optional(),
});

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

    res.json(settings.data);
  } catch (error) {
    console.error('[settings] Error fetching:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// POST /api/settings
router.post('/', async (req, res) => {
  try {
    const validated = SettingsSchema.parse(req.body);

    const newSettings = await prisma.settings.create({
      data: {
        version: validated.version,
        data: validated as any,
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

    broadcastSettingsUpdate(validated);

    res.json({ ok: true, version: validated.version });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[settings] Error saving:', error);
    res.status(500).json({ error: 'save-failed' });
  }
});

export default router;
