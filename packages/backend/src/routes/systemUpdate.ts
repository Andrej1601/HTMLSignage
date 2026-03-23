import { Router } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../lib/auth.js';
import { logAuditEvent, createAuditRequestSnapshot } from '../lib/audit.js';
import {
  readLocalVersion,
  fetchGitHubReleases,
  collectSystemUpdatePreflight,
} from '../lib/systemHelpers.js';
import {
  buildSystemUpdateStatusPayload,
  normalizeSystemUpdateTag,
  runSystemUpdateJob,
} from '../lib/systemUpdateRunner.js';
import { createSystemJob, findRunningSystemJob, runSystemJob } from '../lib/systemJobs.js';

const router = Router();

// GET /update/status
router.get('/update/status', async (req: AuthRequest, res) => {
  try {
    const activeJob = findRunningSystemJob('system-update');
    const [currentVersion, releases, preflight] = await Promise.all([
      readLocalVersion(),
      fetchGitHubReleases(),
      collectSystemUpdatePreflight(),
    ]);

    res.json(buildSystemUpdateStatusPayload({
      currentVersion,
      releases,
      preflight,
      activeJob,
    }));
  } catch (error) {
    console.error('[system] Error checking update status:', error);
    res.status(500).json({
      error: 'status-check-failed',
      message: 'Statusprüfung fehlgeschlagen',
      requestId: req.requestId ?? null,
    });
  }
});

// POST /update/run
const UpdateRunSchema = z.object({
  targetVersion: z.string().min(1),
});

router.post('/update/run', async (req: AuthRequest, res) => {
  const runningJob = findRunningSystemJob('system-update');
  if (runningJob) {
    return res.status(409).json({
      error: 'update-in-progress',
      message: 'Ein Update läuft bereits',
      job: runningJob,
      requestId: req.requestId ?? null,
    });
  }

  const parsed = UpdateRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid-request',
      details: parsed.error.errors,
      requestId: req.requestId ?? null,
    });
  }

  const { targetVersion } = parsed.data;
  const tagName = normalizeSystemUpdateTag(targetVersion);
  const auditRequest = createAuditRequestSnapshot(req);
  const preflight = await collectSystemUpdatePreflight();

  if (!preflight.ready) {
    await logAuditEvent(auditRequest, {
      action: 'system.update.blocked',
      details: {
        targetVersion: tagName,
        blockers: preflight.blockers,
        requestId: auditRequest.requestId ?? null,
      },
    });

    return res.status(409).json({
      error: 'update-preflight-failed',
      message: 'Update-Preflight fehlgeschlagen.',
      preflight,
      requestId: req.requestId ?? null,
    });
  }

  const job = createSystemJob({
    type: 'system-update',
    title: `Update auf ${tagName}`,
    requestId: req.requestId ?? null,
    createdBy: req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
        }
      : null,
  });

  runSystemJob(job.id, (context) => runSystemUpdateJob(context, {
    tagName,
    preflight,
    auditRequest,
  }));

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    job,
    message: `Update auf ${tagName} wurde gestartet.`,
  });
});

export default router;
