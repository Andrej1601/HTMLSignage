import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';

const router = Router();

const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'no-aufguss', 'out-of-order', 'hidden']),
});

// PATCH /api/saunas/:id/status — change sauna status only (requires saunas:status)
router.patch(
  '/:id/status',
  authMiddleware,
  requirePermission('saunas:status'),
  mutationLimiter,
  async (req: AuthRequest, res) => {
    try {
      const { status } = UpdateStatusSchema.parse(req.body);
      const saunaId = req.params.id;

      // Load current active settings
      const current = await prisma.settings.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      });

      if (!current) {
        return res.status(404).json({ error: 'not-found', message: 'Keine aktiven Einstellungen gefunden' });
      }

      const data = { ...(current.data as Record<string, unknown>) };
      const saunas = Array.isArray(data.saunas) ? [...data.saunas] as Array<Record<string, unknown>> : [];

      const saunaIndex = saunas.findIndex((s) => s.id === saunaId);
      if (saunaIndex === -1) {
        return res.status(404).json({ error: 'not-found', message: 'Sauna nicht gefunden' });
      }

      // Update only the status field
      saunas[saunaIndex] = { ...saunas[saunaIndex], status };
      data.saunas = saunas;

      const nextVersion = ((data.version as number) || 1) + 1;
      data.version = nextVersion;

      // Save new settings version
      const newSettings = await prisma.settings.create({
        data: {
          version: nextVersion,
          data: data as unknown as Prisma.InputJsonValue,
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

      broadcastSettingsUpdate(data);

      res.json({ ok: true, saunaId, status, version: nextVersion });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'validation-failed', details: error.errors });
      }
      console.error('[saunas] Error updating status:', error);
      res.status(500).json({ error: 'update-failed', message: 'Sauna-Status konnte nicht aktualisiert werden' });
    }
  }
);

export default router;
