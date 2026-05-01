import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';
import { mirrorAggregateIntoSettings } from '../lib/settingsAggregate.js';
import { logAuditEvent } from '../lib/audit.js';

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
      const saunaId = str(req.params.id);
      if (!saunaId) {
        return res.status(400).json({ error: 'invalid-id', message: 'Sauna-ID fehlt' });
      }

      // Saunas now live in their own table; status is a single-field
      // update with no global Settings version bump required.
      try {
        await prisma.sauna.update({
          where: { id: saunaId },
          data: { status },
        });
      } catch (err) {
        // Prisma throws P2025 when the record doesn't exist.
        if ((err as { code?: string }).code === 'P2025') {
          return res.status(404).json({ error: 'not-found', message: 'Sauna nicht gefunden' });
        }
        throw err;
      }

      invalidateGlobalConfigCache();

      // Broadcast the canonical mirrored settings shape so listeners
      // stay in sync without each one having to re-fetch.
      const activeSettings = await prisma.settings.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { data: true, version: true },
      });
      const baseData = activeSettings
        ? { ...(activeSettings.data as Record<string, unknown>), version: activeSettings.version }
        : { version: 1 };
      const mirrored = await mirrorAggregateIntoSettings(prisma, baseData);
      broadcastSettingsUpdate(mirrored);

      await logAuditEvent(req, {
        action: 'sauna.status.update',
        resource: saunaId,
        details: { status },
      });

      res.json({ ok: true, saunaId, status });
      return;
    } catch (error) {
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
