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
let auditTableAvailable: boolean | null = null;

async function isAuditTableAvailable(): Promise<boolean> {
  if (auditTableAvailable !== null) return auditTableAvailable;

  try {
    await prisma.auditLog.count();
    auditTableAvailable = true;
    return true;
  } catch {
    auditTableAvailable = false;
    console.error('[audit] Audit log table not available. Run `pnpm db:migrate` to create it.');
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
  const available = await isAuditTableAvailable();
  if (!available) return;

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
  const available = await isAuditTableAvailable();
  if (!available) {
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

/**
 * Creates a lightweight snapshot of the request context for use in
 * background tasks (jobs, updates) that outlive the HTTP request.
 */
export function createAuditRequestSnapshot(req: AuthRequest): AuthRequest {
  return {
    userId: req.userId,
    user: req.user,
    ip: req.ip,
    headers: {
      'user-agent': req.headers['user-agent'] || '',
    },
    requestId: req.requestId,
  } as AuthRequest;
}
