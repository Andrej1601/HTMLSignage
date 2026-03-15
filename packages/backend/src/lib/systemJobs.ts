import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { REPO_ROOT, trimLog } from './systemHelpers.js';

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

interface PersistedSystemJobsState {
  version: 1;
  updatedAt: string;
  items: SystemJobRecord[];
}

const MAX_JOBS = 50;
const JOBS_STORE_FILE = path.join(REPO_ROOT, 'logs', 'system-jobs.json');
const jobs = new Map<string, SystemJobRecord>();
const orderedJobIds: string[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function cloneJob<Result = Record<string, unknown> | null>(job: SystemJobRecord<Result>): PublicSystemJob<Result> {
  return JSON.parse(JSON.stringify(job)) as PublicSystemJob<Result>;
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

function persistJobsToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(JOBS_STORE_FILE), { recursive: true });
    const payload: PersistedSystemJobsState = {
      version: 1,
      updatedAt: nowIso(),
      items: orderedJobIds
        .map((jobId) => jobs.get(jobId))
        .filter((job): job is SystemJobRecord => Boolean(job))
        .map((job) => cloneJob(job)),
    };
    const tmpFile = `${JOBS_STORE_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmpFile, JOBS_STORE_FILE);
  } catch (error) {
    console.error('[systemJobs] Failed to persist jobs:', error);
  }
}

function isValidJobStatus(value: unknown): value is SystemJobStatus {
  return value === 'queued' || value === 'running' || value === 'succeeded' || value === 'failed';
}

function isValidJobType(value: unknown): value is SystemJobType {
  return value === 'system-update' || value === 'backup-import';
}

function isSystemJobRecord(value: unknown): value is SystemJobRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SystemJobRecord>;
  return (
    typeof candidate.id === 'string' &&
    isValidJobType(candidate.type) &&
    typeof candidate.title === 'string' &&
    isValidJobStatus(candidate.status) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.log === 'string'
  );
}

function loadJobsFromDisk(): void {
  if (!fs.existsSync(JOBS_STORE_FILE)) return;

  try {
    const raw = fs.readFileSync(JOBS_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedSystemJobsState>;
    const items = Array.isArray(parsed.items) ? parsed.items.filter(isSystemJobRecord) : [];

    jobs.clear();
    orderedJobIds.length = 0;

    items.slice(0, MAX_JOBS).forEach((item) => {
      jobs.set(item.id, cloneJob(item));
      orderedJobIds.push(item.id);
    });
  } catch (error) {
    console.error('[systemJobs] Failed to load persisted jobs:', error);
  }
}

function setJobRunning(jobId: string): void {
  const target = getMutableJob(jobId);
  if (!target) return;
  target.status = 'running';
  target.startedAt = target.startedAt || nowIso();
  persistJobsToDisk();
}

export function setSystemJobProgress(jobId: string, stage: string, message: string, percent?: number): void {
  const target = getMutableJob(jobId);
  if (!target) return;
  target.progress = { stage, message, ...(typeof percent === 'number' ? { percent } : {}) };
  persistJobsToDisk();
}

export function appendSystemJobLog(jobId: string, chunk: string): void {
  if (!chunk.trim()) return;
  const target = getMutableJob(jobId);
  if (!target) return;
  target.log = trimLog(target.log ? `${target.log}\n\n${chunk.trimEnd()}` : chunk.trimEnd());
  persistJobsToDisk();
}

export function succeedSystemJob(jobId: string, result: Record<string, unknown> | null = null): void {
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
  persistJobsToDisk();
}

export function failSystemJob(
  jobId: string,
  code: string,
  message: string,
  result: Record<string, unknown> | null = null,
): void {
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
  persistJobsToDisk();
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
  persistJobsToDisk();
  return job;
}

export function getSystemJob(jobId: string): PublicSystemJob | null {
  const job = jobs.get(jobId);
  return job ? cloneJob(job) : null;
}

export function listSystemJobs(limit = 20): PublicSystemJob[] {
  const safeLimit = Math.max(1, Math.min(limit, MAX_JOBS));
  return orderedJobIds
    .slice(0, safeLimit)
    .map((jobId) => jobs.get(jobId))
    .filter((job): job is SystemJobRecord => Boolean(job))
    .map((job) => cloneJob(job));
}

export function findRunningSystemJob(type: SystemJobType): PublicSystemJob | null {
  for (const jobId of orderedJobIds) {
    const job = jobs.get(jobId);
    if (!job) continue;
    if (job.type === type && (job.status === 'queued' || job.status === 'running')) {
      return cloneJob(job);
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

  setJobRunning(jobId);

  const context: RunSystemJobContext = {
    job,
    setProgress(stage, message, percent) {
      setSystemJobProgress(jobId, stage, message, percent);
    },
    appendLog(chunk) {
      appendSystemJobLog(jobId, chunk);
    },
    succeed(result = null) {
      succeedSystemJob(jobId, result);
    },
    fail(code, message, result = null) {
      failSystemJob(jobId, code, message, result);
    },
  };

  void runner(context).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    context.appendLog(`Unexpected error: ${message}`);
    context.fail('job-runner-failed', message);
  });
}

loadJobsFromDisk();
