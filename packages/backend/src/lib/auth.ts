import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomInt } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

if (!process.env.JWT_SECRET) {
  console.error(
    '\n  FATAL: JWT_SECRET ist nicht gesetzt!\n' +
    '   Bitte einen sicheren Wert in der .env-Datei setzen.\n' +
    '   Beispiel: JWT_SECRET=$(openssl rand -hex 32)\n'
  );
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';
const DEVICE_TOKEN_EXPIRES_IN = '90d';

function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashSessionTokenForExport(token: string): string {
  return hashSessionToken(token);
}

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    username: string;
    email: string | null;
    roles: string[];
  };
  deviceId?: string;
  requestId?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyUserToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId?: unknown; tokenType?: unknown };
    if (typeof payload.userId !== 'string') return null;
    // Device tokens should never pass user auth checks.
    if (payload.tokenType === 'device') return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function generateDeviceToken(deviceId: string): string {
  return jwt.sign(
    { deviceId, tokenType: 'device' },
    JWT_SECRET,
    { expiresIn: DEVICE_TOKEN_EXPIRES_IN },
  );
}

export function verifyDeviceToken(token: string): { deviceId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      deviceId?: unknown;
      tokenType?: unknown;
    };
    if (payload.tokenType !== 'device') return null;
    if (typeof payload.deviceId !== 'string') return null;
    return { deviceId: payload.deviceId };
  } catch {
    return null;
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  if (!token) {
    const cookieToken = req.cookies?.auth_token;
    if (typeof cookieToken === 'string') {
      token = cookieToken;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
    return;
  }

  const payload = verifyUserToken(token);

  if (!payload) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
    return;
  }

  try {
    const now = new Date();
    const tokenHash = hashSessionToken(token);
    const [session, user] = await Promise.all([
      prisma.session.findFirst({
        where: {
          tokenHash,
          userId: payload.userId,
          expiresAt: { gt: now },
        },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          email: true,
          roles: true,
        },
      }),
    ]);

    if (!session) {
      res.status(401).json({ error: 'unauthorized', message: 'Session expired or invalid' });
      return;
    }

    if (!user) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] Middleware error:', error);
    res.status(500).json({ error: 'internal-error', message: 'Interner Serverfehler' });
  }
}

export async function deviceAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const headerToken = req.headers['x-device-token'];
  const authHeader = req.headers.authorization;
  const token = typeof headerToken === 'string'
    ? headerToken
    : (authHeader && authHeader.startsWith('Device ') ? authHeader.substring(7) : null);

  if (!token) {
    res.status(401).json({ error: 'unauthorized', message: 'Device token missing' });
    return;
  }

  const payload = verifyDeviceToken(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid device token' });
    return;
  }

  const routeDeviceId = req.params.id;
  if (routeDeviceId && routeDeviceId !== payload.deviceId) {
    res.status(403).json({ error: 'forbidden', message: 'Device token does not match target device' });
    return;
  }

  const device = await prisma.device.findUnique({
    where: { id: payload.deviceId },
    select: { id: true, tokenRevokedAt: true },
  });
  if (!device) {
    res.status(401).json({ error: 'unauthorized', message: 'Device not found' });
    return;
  }

  if (device.tokenRevokedAt) {
    res.status(401).json({ error: 'unauthorized', message: 'Device token has been revoked' });
    return;
  }

  req.deviceId = payload.deviceId;
  next();
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized', message: 'Nicht authentifiziert' });
      return;
    }

    if (!req.user.roles.includes(role)) {
      res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function generatePairingCode(): string {
  return randomInt(100000, 1000000).toString();
}
