import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord, VersionConflictError } from '../lib/versionedEntity.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
import { SettingsSchema } from '../types/settings.types.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';

const router = Router();

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

    // Create a copy of settings data and add header defaults if missing
    const data = { ...(settings.data as Record<string, unknown>) };
    if (!data.header) {
      data.header = {
        enabled: true,
        showLogo: true,
        logoText: 'HTML Signage',
        showClock: true,
        showDate: true,
        subtitle: 'Premium Wellness & Spa Dashboard',
        height: 8,
      };
      console.log('[settings] Added default header configuration');
    }

    res.json(data);
  } catch (error) {
    console.error('[settings] Error fetching:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Einstellungen konnten nicht geladen werden' });
  }
});

// POST /api/settings (auth required)
router.post('/', authMiddleware, requirePermission('settings:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = SettingsSchema.parse(req.body);
    const settingsToStore = { ...validated };
    // expectedPreviousVersion = the version the client had when they started editing
    // (the client sends version+1, so we subtract 1 to get what they loaded)
    const clientVersion = typeof validated.version === 'number' ? validated.version : null;
    const expectedPreviousVersion = clientVersion !== null ? clientVersion - 1 : undefined;
    const { id, version } = await createVersionedRecord('settings', settingsToStore, {
      expectedPreviousVersion,
    });

    invalidateGlobalConfigCache();
    broadcastSettingsUpdate(settingsToStore);
    await logAuditEvent(req, {
      action: 'settings.update',
      resource: id,
      details: {
        version,
        displayAppearance: validated.displayAppearance || null,
        designStyle: validated.designStyle || null,
        eventCount: validated.events?.length || 0,
        infoCount: validated.infos?.length || 0,
      },
    });

    res.json({ ok: true, version });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return res.status(409).json({
        error: 'version-conflict',
        message: 'Konflikt: Ein anderer Admin hat die Einstellungen zwischenzeitlich gespeichert. Bitte Seite neu laden.',
        latestVersion: error.latestVersion,
      });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[settings] Error saving:', error);
    res.status(500).json({ error: 'save-failed', message: 'Einstellungen konnten nicht gespeichert werden' });
  }
});

export default router;
