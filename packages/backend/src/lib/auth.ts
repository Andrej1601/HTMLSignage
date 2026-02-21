import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

const DEFAULT_SECRET = 'your-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;
const JWT_EXPIRES_IN = '7d';

// Warnung beim Start, wenn kein sicherer JWT_SECRET gesetzt ist
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET) {
  console.warn(
    '\n⚠️  WARNUNG: JWT_SECRET ist nicht gesetzt oder unsicher!\n' +
    '   Bitte einen sicheren Wert in der .env-Datei setzen.\n' +
    '   Beispiel: JWT_SECRET=$(openssl rand -hex 32)\n'
  );
}

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    username: string;
    email: string | null;
    roles: string[];
  };
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

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch (error) {
    return null;
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      return;
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    console.error('[auth] Middleware error:', error);
    res.status(500).json({ error: 'internal-error' });
  }
}

export function requireRole(role: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthorized' });
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
  // Generate a 6-digit pairing code
  return Math.floor(100000 + Math.random() * 900000).toString();
}
