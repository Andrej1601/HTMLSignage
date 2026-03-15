import crypto from 'crypto';
import { trimLog } from './systemHelpers.js';

export type SystemJobType = 'system-update' | 'backup-import';
export type SystemJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SystemJobUser {
  id: string;
  username: string;
  email: string | null;
}

export interface SystemJobProgress {
  stage: string;
  message: string;
  percent?: number;
}

export interface SystemJobErrorInfo {
  code: string;
  message: string;
  requestId?: string | null;
}

export interface SystemJobRecord<Result = Record<string, unknown> | null> {
  id: string;
  type: SystemJobType;
  title: string;
  status: SystemJobStatus;
  requestId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: SystemJobUser | null;
  progress: SystemJobProgress | null;
  log: string;
  result: Result | null;
  error: SystemJobErrorInfo | null;
}

export interface CreateSystemJobInput {
  type: SystemJobType;
  title: string;
  requestId?: string | null;
  createdBy?: SystemJobUser | null;
}

export interface PublicSystemJob<Result = Record<string, unknown> | null> extends SystemJobRecord<Result> {}

interface RunSystemJobContext {
  readonly job: SystemJobRecord;
  setProgress: (stage: string, message: string, percent?: number) => void;
  appendLog: (chunk: string) => void;
  succeed: (result?: Record<string, unknown> | null) => void;
  fail: (code: string, message: string, result?: Record<string, unknown> | null) => void;
}

const MAX_JOBS = 50;
const jobs = new Map<string, SystemJobRecord>();
const orderedJobIds: string[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function trimJobs(): void {
  while (orderedJobIds.length > MAX_JOBS) {
    const staleId = orderedJobIds.pop();
    if (!staleId) break;
    jobs.delete(staleId);
  }
}

function getMutableJob(jobId: string): SystemJobRecord | null {
  return jobs.get(jobId) || null;
}

export function createSystemJob(input: CreateSystemJobInput): SystemJobRecord {
  const job: SystemJobRecord = {
    id: crypto.randomUUID(),
    type: input.type,
    title: input.title,
    status: 'queued',
    requestId: input.requestId || null,
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    createdBy: input.createdBy || null,
    progress: null,
    log: '',
    result: null,
    error: null,
  };

  jobs.set(job.id, job);
  orderedJobIds.unshift(job.id);
  trimJobs();
  return job;
}

export function getSystemJob(jobId: string): PublicSystemJob | null {
  const job = jobs.get(jobId);
  return job ? { ...job } : null;
}

export function listSystemJobs(limit = 20): PublicSystemJob[] {
  const safeLimit = Math.max(1, Math.min(limit, MAX_JOBS));
  return orderedJobIds
    .slice(0, safeLimit)
    .map((jobId) => jobs.get(jobId))
    .filter((job): job is SystemJobRecord => Boolean(job))
    .map((job) => ({ ...job }));
}

export function findRunningSystemJob(type: SystemJobType): PublicSystemJob | null {
  for (const jobId of orderedJobIds) {
    const job = jobs.get(jobId);
    if (!job) continue;
    if (job.type === type && (job.status === 'queued' || job.status === 'running')) {
      return { ...job };
    }
  }
  return null;
}

export function runSystemJob(
  jobId: string,
  runner: (context: RunSystemJobContext) => Promise<void>,
): void {
  const job = getMutableJob(jobId);
  if (!job) return;

  job.status = 'running';
  job.startedAt = nowIso();

  const context: RunSystemJobContext = {
    job,
    setProgress(stage, message, percent) {
      const target = getMutableJob(jobId);
      if (!target) return;
      target.progress = { stage, message, ...(typeof percent === 'number' ? { percent } : {}) };
    },
    appendLog(chunk) {
      if (!chunk.trim()) return;
      const target = getMutableJob(jobId);
      if (!target) return;
      target.log = trimLog(target.log ? `${target.log}\n\n${chunk.trimEnd()}` : chunk.trimEnd());
    },
    succeed(result = null) {
      const target = getMutableJob(jobId);
      if (!target) return;
      target.status = 'succeeded';
      target.finishedAt = nowIso();
      target.result = result;
      target.error = null;
      target.progress = {
        stage: 'done',
        message: 'Abgeschlossen',
        percent: 100,
      };
    },
    fail(code, message, result = null) {
      const target = getMutableJob(jobId);
      if (!target) return;
      target.status = 'failed';
      target.finishedAt = nowIso();
      target.result = result;
      target.error = {
        code,
        message,
        requestId: target.requestId,
      };
      target.progress = {
        stage: 'failed',
        message,
      };
    },
  };

  void runner(context).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    context.appendLog(`Unexpected error: ${message}`);
    context.fail('job-runner-failed', message);
  });
}
