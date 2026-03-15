import { Router } from 'express';
import type { AuthRequest } from '../lib/auth.js';
import { collectSystemRuntimeStatus } from '../lib/maintenance.js';
import { getRuntimeHistory } from '../lib/runtimeHistory.js';

const router = Router();

router.get('/runtime-status', async (_req: AuthRequest, res) => {
  try {
    const status = await collectSystemRuntimeStatus();
    res.json(status);
  } catch (error) {
    console.error('[system] Error collecting runtime status:', error);
    res.status(500).json({ error: 'runtime-status-failed', message: 'Laufzeitstatus konnte nicht geladen werden' });
  }
});

router.get('/runtime-history', async (req: AuthRequest, res) => {
  const hours = Number.parseInt(String(req.query.hours || '24'), 10);
  try {
    const history = await getRuntimeHistory(Number.isFinite(hours) ? hours : 24);
    res.json(history);
  } catch (error) {
    console.error('[system] Error collecting runtime history:', error);
    res.status(500).json({ error: 'runtime-history-failed', message: 'Laufzeitverlauf konnte nicht geladen werden' });
  }
});

export default router;
