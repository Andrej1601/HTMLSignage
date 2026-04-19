import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { PrismaStore } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
import type { AuthRequest } from '../lib/auth.js';

const router = Router();

/**
 * Accepts crash reports from the display client's design-pack
 * ErrorBoundary. No auth: the display runs in kiosk mode and may
 * not have a session cookie when an early boot failure happens.
 * Payloads are size-limited and rate-limited, and the only persistence
 * is into the existing audit log so there is no new data surface.
 */
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'too-many-requests',
    message: 'Zu viele Telemetrie-Meldungen. Bitte kurz warten.',
  },
  store: new PrismaStore({ prefix: 'telemetry_' }),
});

/** Known slide types, hardcoded to keep this route independent of the SDK. */
const SLIDE_TYPE_VALUES = [
  'sauna-detail',
  'content-panel',
  'infos',
  'events',
  'media-image',
  'media-video',
] as const;

const DesignErrorReportSchema = z.object({
  designId: z.string().trim().min(1).max(80),
  slideType: z.enum(SLIDE_TYPE_VALUES),
  message: z.string().trim().min(1).max(500),
  stack: z.string().trim().max(4000).optional(),
  componentStack: z.string().trim().max(4000).optional(),
  url: z.string().trim().max(500).optional(),
  deviceId: z.string().trim().max(120).optional(),
  userAgent: z.string().trim().max(500).optional(),
});

/**
 * Design-pack renderer crash report.
 *   POST /api/telemetry/display/error
 */
router.post('/display/error', telemetryLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = DesignErrorReportSchema.parse(req.body);

    await logAuditEvent(req, {
      action: 'design.pack.error',
      resource: validated.deviceId || null,
      details: {
        designId: validated.designId,
        slideType: validated.slideType,
        message: validated.message,
        // Keep the stack but trim any leading/trailing whitespace —
        // saves bytes and still gives operators a useful jump point.
        stack: validated.stack,
        componentStack: validated.componentStack,
        url: validated.url,
        userAgent: validated.userAgent,
      },
    });

    // 202 Accepted: we've taken the report but don't expose storage
    // confirmation details back to the client.
    return res.status(202).json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation-failed',
        details: error.issues,
      });
    }
    console.error('[telemetry] Failed to record design error:', error);
    // Never fail loud — telemetry must not cascade into a second
    // error on the client. Respond 202 regardless; the client
    // doesn't retry on success.
    return res.status(202).json({ ok: true });
  }
});

export default router;
