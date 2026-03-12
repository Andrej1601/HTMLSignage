import { Router } from 'express';
import { authMiddleware } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import systemUpdateRouter from './systemUpdate.js';
import systemBackupRouter from './systemBackup.js';

const router = Router();

// All system routes require admin authentication.
router.use(authMiddleware, requirePermission('system:manage'));

router.use(systemUpdateRouter);
router.use(systemBackupRouter);

export default router;
