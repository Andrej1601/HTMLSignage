import { Router } from 'express';
import type { AuthRequest } from '../lib/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { collectSystemRuntimeStatus } from '../lib/maintenance.js';
import { getRuntimeHistory } from '../lib/runtimeHistory.js';

const router = Router();

router.get('/runtime-status', asyncHandler(async (_req: AuthRequest, res) => {
  const status = await collectSystemRuntimeStatus();
  res.json(status);
}));

router.get('/runtime-history', asyncHandler(async (req: AuthRequest, res) => {
  const hours = Number.parseInt(String(req.query.hours || '24'), 10);
  const history = await getRuntimeHistory(Number.isFinite(hours) ? hours : 24);
  res.json(history);
}));

export default router;
