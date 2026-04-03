import { Router } from 'express';
import { z } from 'zod';
import { getSystemJob, listSystemJobs } from '../lib/systemJobs.js';
import type { AuthRequest } from '../lib/auth.js';

const router = Router();

const ListJobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get('/jobs', async (req: AuthRequest, res) => {
  const parsed = ListJobsQuerySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit ?? 20 : 20;

  res.json({
    ok: true,
    items: await listSystemJobs(limit),
  });
});

router.get('/jobs/:jobId', (req: AuthRequest, res) => {
  const job = getSystemJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: 'job-not-found',
      message: 'Systemjob nicht gefunden',
      requestId: req.requestId ?? null,
    });
  }

  return res.json({
    ok: true,
    job,
  });
});

export default router;
