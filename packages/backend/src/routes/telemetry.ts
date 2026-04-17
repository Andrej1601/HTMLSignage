import { Router } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../lib/auth.js';
import { authOrDeviceMiddleware } from '../lib/auth.js';
import { logAuditEvent } from '../lib/audit.js';

const router = Router();

const designErrorSchema = z.object({
  designId: z.string().min(1).max(64),
  slideType: z.string().min(1).max(64),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  componentStack: z.string().max(8000).optional(),
  occurredAt: z.string().datetime().optional(),
});

/**
 * Display-side design-pack telemetry. Writes a single audit-log entry
 * each time a design renderer crashes inside the host's
 * DesignErrorBoundary. Accessible to both admin users and paired
 * display devices (for headless installs that have no logged-in user).
 */
router.post('/display/error', authOrDeviceMiddleware, async (req: AuthRequest, res) => {
  const parsed = designErrorSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid-telemetry-payload',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const payload = parsed.data;

  await logAuditEvent(req, {
    action: 'display.design.crash',
    resource: payload.designId,
    details: {
      designId: payload.designId,
      slideType: payload.slideType,
      message: payload.message,
      stack: payload.stack,
      componentStack: payload.componentStack,
      occurredAt: payload.occurredAt ?? new Date().toISOString(),
      deviceId: req.deviceId ?? null,
    },
  });

  res.status(204).end();
});

export default router;
