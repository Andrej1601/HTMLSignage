import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import type { AuthRequest } from './auth.js';

export interface AuditLogPayload {
  action: string;
  resource?: string | null;
  details?: Prisma.InputJsonValue | null;
}

export interface AuditLogListOptions {
  limit?: number;
  cursor?: string | null;
  actions?: string[];
}

const DEFAULT_AUDIT_LIMIT = 50;
const MAX_AUDIT_LIMIT = 200;
let auditInfrastructureEnsured = false;
let auditInfrastructureFailed = false;

async function ensureAuditInfrastructure(): Promise<boolean> {
  if (auditInfrastructureEnsured) return true;
  if (auditInfrastructureFailed) return false;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" text PRIMARY KEY,
        "userId" text,
        "action" text NOT NULL,
        "resource" text,
        "details" jsonb,
        "ipAddress" text,
        "userAgent" text,
        "timestamp" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "audit_logs_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp" DESC)',
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp" DESC)',
    );
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC)',
    );

    auditInfrastructureEnsured = true;
    return true;
  } catch (error) {
    auditInfrastructureFailed = true;
    console.error('[audit] Failed to ensure audit log infrastructure:', error);
    return false;
  }
}

function normalizeIpAddress(req: AuthRequest): string | null {
  return typeof req.ip === 'string' && req.ip.trim() !== '' ? req.ip : null;
}

function normalizeUserAgent(req: AuthRequest): string | null {
  const value = req.headers['user-agent'];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function serializeDetails(details: unknown): Prisma.InputJsonValue | undefined {
  if (details === undefined || details === null) return undefined;
  return JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue;
}

export async function logAuditEvent(req: AuthRequest, payload: AuditLogPayload): Promise<void> {
  const ready = await ensureAuditInfrastructure();
  if (!ready) return;

  try {
    await prisma.auditLog.create({
      data: {
        userId: req.userId ?? null,
        action: payload.action,
        resource: payload.resource ?? null,
        details: serializeDetails(payload.details),
        ipAddress: normalizeIpAddress(req),
        userAgent: normalizeUserAgent(req),
      },
    });
  } catch (error) {
    console.error('[audit] Failed to write audit log:', error);
  }
}

export async function listAuditLogs(options: AuditLogListOptions = {}) {
  const ready = await ensureAuditInfrastructure();
  if (!ready) {
    return {
      items: [],
      nextCursor: null,
      unavailable: true,
    };
  }

  const limit = Math.min(Math.max(options.limit ?? DEFAULT_AUDIT_LIMIT, 1), MAX_AUDIT_LIMIT);
  const cursor = options.cursor?.trim() || null;
  const actions = Array.isArray(options.actions)
    ? options.actions.map((action) => action.trim()).filter(Boolean)
    : [];

  const logs = await prisma.auditLog.findMany({
    where: actions.length > 0
      ? {
          action: {
            in: actions,
          },
        }
      : undefined,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: [
      { timestamp: 'desc' },
      { id: 'desc' },
    ],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > limit;
  const items = hasMore ? logs.slice(0, limit) : logs;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    unavailable: false,
  };
}
