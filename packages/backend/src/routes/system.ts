import { Router } from 'express';
import { authMiddleware, requireRole } from '../lib/auth.js';
import systemUpdateRouter from './systemUpdate.js';
import systemBackupRouter from './systemBackup.js';

const router = Router();

// All system routes require admin authentication.
router.use(authMiddleware, requireRole('admin'));

router.use(systemUpdateRouter);
router.use(systemBackupRouter);

export default router;
