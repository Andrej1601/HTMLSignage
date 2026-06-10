import { Router } from 'express';
import type { AuthRequest } from '../lib/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { listAuditLogs } from '../lib/audit.js';

const router = Router();

router.get('/audit', asyncHandler(async (req: AuthRequest, res) => {
  const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;

  // Optional `actions` filter, accepted as either `?actions=a,b` or
  // repeated `?actions=a&actions=b`. Trimmed, empty values dropped.
  const rawActions = req.query.actions;
  let actions: string[] | undefined;
  if (Array.isArray(rawActions)) {
    actions = rawActions
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0);
  } else if (typeof rawActions === 'string') {
    actions = rawActions
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
  if (actions && actions.length === 0) actions = undefined;

  const result = await listAuditLogs({ limit, cursor, actions });
  res.json({
    ok: true,
    items: result.items,
    nextCursor: result.nextCursor,
    unavailable: result.unavailable,
  });
}));

export default router;
