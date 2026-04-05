import { Router } from 'express';
import { authMiddleware } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import systemUpdateRouter from './systemUpdate.js';
import systemBackupRouter from './systemBackup.js';
import systemRuntimeRouter from './systemRuntime.js';
import systemAuditRouter from './systemAudit.js';
import systemJobsRouter from './systemJobs.js';

const router = Router();

router.use(authMiddleware);
router.use(systemRuntimeRouter);
router.use(requirePermission('system:manage'));

router.use(systemJobsRouter);
router.use(systemAuditRouter);
router.use(systemUpdateRouter);
router.use(systemBackupRouter);

export default router;
