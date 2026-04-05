import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { MAX_UPDATE_LOG_CHARS } from './systemHelpers.js';

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

export interface RunSystemJobContext {
  readonly job: SystemJobRecord;
  setProgress: (stage: string, message: string, percent?: number) => void;
  appendLog: (chunk: string) => void;
  succeed: (result?: Record<string, unknown> | null) => void;
  fail: (code: string, message: string, result?: Record<string, unknown> | null) => void;
}

const MAX_JOBS = 50;

function mapPrismaJob(raw: {
  id: string;
  type: string;
  title: string;
  status: string;
  requestId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdBy: unknown;
  progress: unknown;
  log: string;
  result: unknown;
  error: unknown;
}): SystemJobRecord {
  return {
    id: raw.id,
    type: raw.type as SystemJobType,
    title: raw.title,
    status: raw.status as SystemJobStatus,
    requestId: raw.requestId,
    createdAt: raw.createdAt.toISOString(),
    startedAt: raw.startedAt?.toISOString() ?? null,
    finishedAt: raw.finishedAt?.toISOString() ?? null,
    createdBy: (raw.createdBy as SystemJobUser | null) ?? null,
    progress: (raw.progress as SystemJobProgress | null) ?? null,
    log: raw.log,
    result: (raw.result as Record<string, unknown> | null) ?? null,
    error: (raw.error as SystemJobErrorInfo | null) ?? null,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

export async function setSystemJobProgress(jobId: string, stage: string, message: string, percent?: number): Promise<void> {
  await prisma.systemJob.update({
    where: { id: jobId },
    data: {
      progress: { stage, message, ...(typeof percent === 'number' ? { percent } : {}) },
    },
  });
}

export async function appendSystemJobLog(jobId: string, chunk: string): Promise<void> {
  if (!chunk.trim()) return;
  const trimmed = chunk.trimEnd();
  const job = await prisma.systemJob.findUnique({ where: { id: jobId }, select: { log: true } });
  if (!job) return;
  const newLog = (job.log + `\n\n${trimmed}`).slice(-MAX_UPDATE_LOG_CHARS);
  await prisma.systemJob.update({
    where: { id: jobId },
    data: { log: newLog },
  });
}

export async function succeedSystemJob(jobId: string, result: Record<string, unknown> | null = null): Promise<void> {
  await prisma.systemJob.update({
    where: { id: jobId },
    data: {
      status: 'succeeded',
      finishedAt: new Date(),
      result: toPrismaJson(result),
      error: undefined,
      progress: { stage: 'done', message: 'Abgeschlossen', percent: 100 },
    },
  });
}

export async function failSystemJob(
  jobId: string,
  code: string,
  message: string,
  result: Record<string, unknown> | null = null,
): Promise<void> {
  const job = await prisma.systemJob.findUnique({ where: { id: jobId }, select: { requestId: true } });
  await prisma.systemJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      result: toPrismaJson(result),
      error: { code, message, requestId: job?.requestId ?? null },
      progress: { stage: 'failed', message },
    },
  });
}

export async function createSystemJob(input: CreateSystemJobInput): Promise<SystemJobRecord> {
  const raw = await prisma.systemJob.create({
    data: {
      type: input.type,
      title: input.title,
      status: 'queued',
      requestId: input.requestId || undefined,
      createdBy: input.createdBy ? toPrismaJson(input.createdBy) : undefined,
      log: '',
    },
  });

  const job = mapPrismaJob(raw);

  const count = await prisma.systemJob.count();
  if (count > MAX_JOBS) {
    const oldest = await prisma.systemJob.findMany({
      orderBy: { createdAt: 'asc' },
      take: count - MAX_JOBS,
      select: { id: true },
    });
    await prisma.systemJob.deleteMany({
      where: { id: { in: oldest.map((o) => o.id) } },
    });
  }

  return job;
}

export async function getSystemJob(jobId: string): Promise<PublicSystemJob | null> {
  const raw = await prisma.systemJob.findUnique({ where: { id: jobId } });
  return raw ? mapPrismaJob(raw) : null;
}

export async function listSystemJobs(limit = 20): Promise<PublicSystemJob[]> {
  const safeLimit = Math.max(1, Math.min(limit, MAX_JOBS));
  const raw = await prisma.systemJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  });
  return raw.map(mapPrismaJob);
}

export async function findRunningSystemJob(type: SystemJobType): Promise<PublicSystemJob | null> {
  const raw = await prisma.systemJob.findFirst({
    where: {
      type,
      status: { in: ['queued', 'running'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  return raw ? mapPrismaJob(raw) : null;
}

export function runSystemJob(
  jobId: string,
  runner: (context: RunSystemJobContext) => Promise<void>,
): void {
  let jobRecord: SystemJobRecord | null = null;

  const context: RunSystemJobContext = {
    get job() {
      return jobRecord!;
    },
    async setProgress(stage, message, percent) {
      await setSystemJobProgress(jobId, stage, message, percent);
    },
    async appendLog(chunk) {
      await appendSystemJobLog(jobId, chunk);
    },
    async succeed(result = null) {
      await succeedSystemJob(jobId, result);
    },
    async fail(code, message, result = null) {
      await failSystemJob(jobId, code, message, result);
    },
  };

  void (async () => {
    jobRecord = await getSystemJob(jobId);
    if (!jobRecord) return;

    await prisma.systemJob.update({
      where: { id: jobId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    await runner(context);
  })().catch(async (error) => {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    await appendSystemJobLog(jobId, `Unexpected error: ${message}`);
    await failSystemJob(jobId, 'job-runner-failed', message);
  });
}
