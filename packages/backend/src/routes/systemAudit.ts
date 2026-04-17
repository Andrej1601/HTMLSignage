import { Router } from 'express';
import type { AuthRequest } from '../lib/auth.js';
import { listAuditLogs } from '../lib/audit.js';

const router = Router();

router.get('/audit', async (req: AuthRequest, res) => {
  try {
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const actionsParam = typeof req.query.actions === 'string' ? req.query.actions : '';
    const actions = actionsParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const result = await listAuditLogs({
      limit,
      cursor,
      actions: actions.length > 0 ? actions : undefined,
    });
    res.json({
      ok: true,
      items: result.items,
      nextCursor: result.nextCursor,
      unavailable: result.unavailable,
    });
  } catch (error) {
    console.error('[system] Error loading audit log:', error);
    res.status(500).json({ error: 'audit-log-fetch-failed', message: 'Audit-Log konnte nicht geladen werden' });
  }
});

export default router;
