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

    const record = await prisma.rateLimit.findUnique({
      where: { key: prefixedKey },
    });

    if (!record || record.expiresAt <= now) {
      await prisma.rateLimit.upsert({
        where: { key: prefixedKey },
        update: { count: 1, expiresAt },
        create: { key: prefixedKey, count: 1, expiresAt },
      });
      return { totalHits: 1, resetTime: expiresAt };
    }

    const newCount = record.count + 1;
    await prisma.rateLimit.update({
      where: { key: prefixedKey },
      data: { count: newCount },
    });

    return { totalHits: newCount, resetTime: record.expiresAt };
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
