import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord } from '../lib/versionedEntity.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { updateSaunaStatusInSettings, SaunaNotFoundError } from '../lib/saunaManagement.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';

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
      const saunaId = str(req.params.id)!;

      // Load current active settings
      const current = await prisma.settings.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      });

      if (!current) {
        return res.status(404).json({ error: 'not-found', message: 'Keine aktiven Einstellungen gefunden' });
      }

      const data = { ...(current.data as Record<string, unknown>) };
      updateSaunaStatusInSettings(data, saunaId, status);

      const { version } = await createVersionedRecord('settings', data);

      invalidateGlobalConfigCache();
      broadcastSettingsUpdate(data);

      res.json({ ok: true, saunaId, status, version });
      return;
    } catch (error) {
      if (error instanceof SaunaNotFoundError) {
        return res.status(404).json({ error: 'not-found', message: 'Sauna nicht gefunden' });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'validation-failed', details: error.issues });
      }
      console.error('[saunas] Error updating status:', error);
      res.status(500).json({ error: 'update-failed', message: 'Sauna-Status konnte nicht aktualisiert werden' });
      return;
    }
  }
);

export default router;
