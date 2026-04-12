import type {
  Store,
  Options,
  IncrementResponse,
  ClientRateLimitInfo,
} from 'express-rate-limit';
import rateLimit from 'express-rate-limit';
import { prisma } from './prisma.js';

export class PrismaStore implements Store {
  windowMs!: number;
  prefix!: string;

  constructor(options?: { prefix?: string }) {
    this.prefix = options?.prefix ?? 'rl_';
  }

  init(options: Options): void {
    this.windowMs = options.windowMs ?? 60_000;
  }

  prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const record = await prisma.rateLimit.findUnique({
      where: { key: this.prefixKey(key) },
    });
    if (!record || record.expiresAt <= new Date()) return undefined;
    return { totalHits: record.count, resetTime: record.expiresAt };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const prefixedKey = this.prefixKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.windowMs);

    // Single atomic SQL: insert or conditionally increment/reset on conflict.
    // Avoids the findUnique → update race condition where two concurrent
    // requests both see "no record" and both create with count=1.
    type Row = { count: number; expiresAt: Date };
    const rows = await prisma.$queryRaw<Row[]>`
      INSERT INTO rate_limits (id, key, count, "expiresAt", "createdAt")
      VALUES (gen_random_uuid()::text, ${prefixedKey}, 1, ${expiresAt}, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN rate_limits."expiresAt" <= ${now} THEN 1
                     ELSE rate_limits.count + 1
                END,
        "expiresAt" = CASE WHEN rate_limits."expiresAt" <= ${now} THEN ${expiresAt}
                           ELSE rate_limits."expiresAt"
                      END
      RETURNING count, "expiresAt"
    `;

    const row = rows[0];
    return { totalHits: Number(row.count), resetTime: row.expiresAt };
  }

  async decrement(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    await prisma.rateLimit.update({
      where: { key: prefixedKey },
      data: { count: { decrement: 1 } },
    }).catch(() => {});
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimit.delete({
      where: { key: this.prefixKey(key) },
    }).catch(() => {});
  }

  async resetAll(): Promise<void> {
    await prisma.rateLimit.deleteMany({}).catch(() => {});
  }
}

export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Anfragen. Bitte später erneut versuchen.' },
  store: new PrismaStore({ prefix: 'mutation_' }),
});

export const pairingRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Pairing-Anfragen. Bitte kurz warten.' },
  store: new PrismaStore({ prefix: 'pairing_' }),
});

export const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Heartbeats. Bitte kurz warten.' },
  store: new PrismaStore({ prefix: 'heartbeat_' }),
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too-many-requests', message: 'Zu viele Uploads. Bitte kurz warten.' },
  store: new PrismaStore({ prefix: 'upload_' }),
});

export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await prisma.rateLimit.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
