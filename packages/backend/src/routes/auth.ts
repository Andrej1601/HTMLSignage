import { Router } from 'express';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword, generateToken, authMiddleware, type AuthRequest } from '../lib/auth.js';
import { sendPasswordResetEmail } from '../lib/mailer.js';

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

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(32).max(512),
  password: z.string().min(6),
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createResetToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return { rawToken, tokenHash, expiresAt };
}

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

// POST /api/auth/forgot-password - Request password reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const validated = ForgotPasswordSchema.parse(req.body);
    const genericResponse = {
      ok: true,
      message: 'If the account exists, a password reset email has been sent.',
    };

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: validated.email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (!user?.email) {
      return res.json(genericResponse);
    }

    const { rawToken, tokenHash, expiresAt } = createResetToken();

    const resetToken = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      select: {
        id: true,
      },
    });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        token: rawToken,
      });
    } catch (mailError) {
      // Remove the token when sending failed to avoid orphaned valid reset links.
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      console.error('[auth] Forgot password mail error:', mailError);
    }

    return res.json(genericResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[auth] Forgot password error:', error);
    return res.status(500).json({ error: 'forgot-password-failed' });
  }
});

// POST /api/auth/reset-password - Set a new password using reset token
router.post('/reset-password', async (req, res) => {
  try {
    const validated = ResetPasswordSchema.parse(req.body);
    const tokenHash = hashResetToken(validated.token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        error: 'invalid-or-expired-token',
        message: 'Reset link is invalid or expired.',
      });
    }

    const newPasswordHash = await hashPassword(validated.password);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: newPasswordHash },
      }),
      prisma.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      }),
    ]);

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[auth] Reset password error:', error);
    return res.status(500).json({ error: 'reset-password-failed' });
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
