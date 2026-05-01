import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord, VersionConflictError } from '../lib/versionedEntity.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { authMiddleware, authOrDeviceMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
import { SettingsSchema } from '../types/settings.types.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';
import {
  mirrorAggregateIntoSettings,
  syncAggregateFromSettings,
  stripAggregateFromSettings,
} from '../lib/settingsAggregate.js';

const router = Router();

// GET /api/settings (admin user OR paired device)
router.get('/', authOrDeviceMiddleware, async (_req: AuthRequest, res) => {
  try {
    const settings = await prisma.settings.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!settings) {
      // Empty install: emit a minimal envelope but still mirror tables
      // so the FE sees an empty saunas/aromas/infos/events array
      // (rather than `undefined` which it doesn't gracefully handle).
      const mirrored = await mirrorAggregateIntoSettings(prisma, { version: 1 });
      return res.json(mirrored);
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

    // The canonical slideshow lives in the `slideshows` table (row with
    // `isDefault: true`). We ALWAYS mirror that into the response and
    // never trust a stale `settings.data.slideshow` JSON from records
    // written before the slideshow split.
    const defaultSlideshow = await prisma.slideshow.findFirst({
      where: { isDefault: true },
      select: { config: true },
    });
    if (defaultSlideshow) {
      data.slideshow = defaultSlideshow.config;
    } else {
      delete data.slideshow;
    }

    // Saunas, aromas, info items, and events live in dedicated tables
    // since the settings-aggregate split. Always mirror them in so the
    // wire format stays the same for existing FE consumers.
    const enriched = await mirrorAggregateIntoSettings(prisma, data);

    res.json(enriched);
    return;
  } catch (error) {
    console.error('[settings] Error fetching:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Einstellungen konnten nicht geladen werden' });
    return;
  }
});

// POST /api/settings (auth required)
router.post('/', authMiddleware, requirePermission('settings:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = SettingsSchema.parse(req.body);

    // Sync saunas/aromas/infos/events into their dedicated tables and
    // strip them from the JSON payload before persisting. The Settings
    // record now stores only the global theme/header/maintenance/etc.
    // — the four aggregates live in their own tables and are mirrored
    // back on GET. Wrapping in a single transaction so a partial failure
    // doesn't leave the tables and the Settings row out of sync.
    const settingsToStore = await prisma.$transaction(async (tx) => {
      await syncAggregateFromSettings(tx, validated as unknown as Record<string, unknown>);
      const stripped = stripAggregateFromSettings(validated as unknown as Record<string, unknown>);
      return stripped;
    });

    const clientVersion = typeof validated.version === 'number' ? validated.version : null;
    const expectedPreviousVersion = clientVersion !== null ? clientVersion - 1 : undefined;
    const { id, version } = await createVersionedRecord('settings', settingsToStore, {
      expectedPreviousVersion,
    });

    invalidateGlobalConfigCache();
    // Broadcast the canonical mirrored shape so listeners see the same
    // payload as a fresh GET.
    const mirrored = await mirrorAggregateIntoSettings(prisma, { ...settingsToStore, version });
    broadcastSettingsUpdate(mirrored);
    await logAuditEvent(req, {
      action: 'settings.update',
      resource: id,
      details: {
        version,
        displayAppearance: validated.displayAppearance || null,
        designStyle: validated.designStyle || null,
        eventCount: validated.events?.length || 0,
        infoCount: validated.infos?.length || 0,
        saunaCount: validated.saunas?.length || 0,
        aromaCount: validated.aromas?.length || 0,
      },
    });

    res.json({ ok: true, version });
    return;
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
    return;
  }
});

export default router;
