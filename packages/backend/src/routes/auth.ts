import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword, generateToken, authMiddleware, type AuthRequest } from '../lib/auth.js';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(6),
});

// POST /api/auth/register - Register new user (ONLY first user - becomes admin)
router.post('/register', async (req, res) => {
  try {
    const validated = RegisterSchema.parse(req.body);

    // Check if this is the first user
    const userCount = await prisma.user.count();

    // Only allow registration if this is the first user
    if (userCount > 0) {
      return res.status(403).json({
        error: 'registration-disabled',
        message: 'Self-registration is disabled. Please contact an administrator.'
      });
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (existing) {
      return res.status(400).json({ error: 'username-taken', message: 'Username already exists' });
    }

    // First user gets all roles
    const roles = ['admin', 'editor', 'viewer'];

    const hashedPassword = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        username: validated.username,
        email: validated.email,
        password: hashedPassword,
        roles,
      },
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        createdAt: true,
      },
    });

    const token = generateToken(user.id);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      user,
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[auth] Registration error:', error);
    res.status(500).json({ error: 'registration-failed' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const validated = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (!user) {
      return res.status(401).json({ error: 'invalid-credentials', message: 'Invalid username or password' });
    }

    const validPassword = await comparePassword(validated.password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'invalid-credentials', message: 'Invalid username or password' });
    }

    const token = generateToken(user.id);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[auth] Login error:', error);
    res.status(500).json({ error: 'login-failed' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.substring(7);

    if (token) {
      await prisma.session.deleteMany({
        where: { token },
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[auth] Logout error:', error);
    res.status(500).json({ error: 'logout-failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    res.json(req.user);
  } catch (error) {
    console.error('[auth] Me error:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

export default router;
