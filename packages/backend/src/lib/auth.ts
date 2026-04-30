import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
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

/** Express 5: req.params/query values can be string | string[]. Extracts a single string. */
export function str(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
    select: { id: true, tokenRevokedAt: true, pairedAt: true },
  });
  if (!device) {
    res.status(401).json({ error: 'unauthorized', message: 'Device not found' });
    return;
  }

  if (device.tokenRevokedAt) {
    res.status(401).json({ error: 'unauthorized', message: 'Device token has been revoked' });
    return;
  }

  if (!device.pairedAt) {
    res.status(401).json({ error: 'unpaired', message: 'Device is not paired yet' });
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

/**
 * Verifies a JWT token as either a valid user token or device token
 * (signature + expiry only, no DB session check).
 * Use for lightweight auth gates like WebSocket subscriptions.
 */
export function verifyAnyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return verifyUserToken(token) !== null || verifyDeviceToken(token) !== null;
}

/**
 * Middleware that accepts either user auth (Bearer/cookie) or device auth
 * (X-Device-Token / Authorization: Device …).
 * Use on routes that need to be accessible to both admin users and display devices.
 */
export async function authOrDeviceMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // 1. Try user auth (Bearer token or cookie)
  let userToken: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  }
  if (!userToken) {
    const cookieToken = req.cookies?.auth_token;
    if (typeof cookieToken === 'string') {
      userToken = cookieToken;
    }
  }

  if (userToken) {
    const payload = verifyUserToken(userToken);
    if (payload) {
      try {
        const now = new Date();
        const tokenHash = hashSessionToken(userToken);
        const [session, user] = await Promise.all([
          prisma.session.findFirst({
            where: { tokenHash, userId: payload.userId, expiresAt: { gt: now } },
            select: { id: true },
          }),
          prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, username: true, email: true, roles: true },
          }),
        ]);

        if (session && user) {
          req.userId = user.id;
          req.user = user;
          next();
          return;
        }
      } catch (error) {
        console.error('[auth] authOrDeviceMiddleware user-auth error:', error);
      }
    }
  }

  // 2. Try device auth (X-Device-Token header or Authorization: Device …)
  const deviceHeaderToken = req.headers['x-device-token'];
  const deviceTokenValue = typeof deviceHeaderToken === 'string'
    ? deviceHeaderToken
    : (authHeader && authHeader.startsWith('Device ') ? authHeader.substring(7) : null);

  if (deviceTokenValue) {
    const payload = verifyDeviceToken(deviceTokenValue);
    if (payload) {
      try {
        const device = await prisma.device.findUnique({
          where: { id: payload.deviceId },
          select: { id: true, tokenRevokedAt: true, pairedAt: true },
        });
        if (device && !device.tokenRevokedAt && device.pairedAt) {
          req.deviceId = payload.deviceId;
          next();
          return;
        }
      } catch (error) {
        console.error('[auth] authOrDeviceMiddleware device-auth error:', error);
      }
    }
  }

  res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
}

export function generatePairingCode(): string {
  return randomInt(100000, 1000000).toString();
}

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_TOKEN_BYTES = 32;
const CSRF_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_COOKIE_SECURE = process.env.COOKIE_SECURE !== undefined
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

/**
 * Issues a per-session CSRF token. Sets it as a non-httpOnly cookie (works
 * for same-origin SPA setups via `document.cookie`) AND returns it as a
 * `X-CSRF-Token` response header (works for cross-origin setups where
 * `document.cookie` cannot read cookies set by a different origin).
 *
 * The cookie remains the source of truth on the server side — the middleware
 * compares the incoming `X-CSRF-Token` header against the cookie value.
 */
export function issueCsrfCookie(res: Response): string {
  const token = randomBytes(CSRF_TOKEN_BYTES).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: CSRF_COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.setHeader('X-CSRF-Token', token);
  return token;
}

/**
 * Re-emits the existing CSRF token to the response header without
 * rotating it (so concurrent tabs that already cached the token keep
 * working). Used by `/auth/me` so the cross-origin SPA can pick up the
 * token even when its session cookie was set in a previous load.
 *
 * Returns the token if one already exists, or issues a fresh one when
 * the cookie is absent.
 */
export function refreshCsrfTokenHeader(req: Request, res: Response): string {
  const existing = typeof req.cookies?.csrf_token === 'string' ? req.cookies.csrf_token : '';
  if (existing) {
    res.setHeader('X-CSRF-Token', existing);
    return existing;
  }
  return issueCsrfCookie(res);
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
}

export function csrfTokensMatch(headerValue: unknown, cookieValue: unknown): boolean {
  if (typeof headerValue !== 'string' || typeof cookieValue !== 'string') return false;
  if (headerValue.length === 0 || headerValue.length !== cookieValue.length) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(cookieValue);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
