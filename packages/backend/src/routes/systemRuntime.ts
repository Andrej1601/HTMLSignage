import { Router } from 'express';
import type { AuthRequest } from '../lib/auth.js';
import { collectSystemRuntimeStatus } from '../lib/maintenance.js';

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

export default router;
