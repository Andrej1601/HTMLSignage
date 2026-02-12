import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, authMiddleware, type AuthRequest } from '../lib/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional(),
  password: z.string().min(6),
  roles: z.array(z.string()).default(['viewer']),
});

const UpdateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional().nullable(),
  password: z.string().min(6).optional(),
  roles: z.array(z.string()).optional(),
});

// Middleware to check if user is admin
function requireAdmin(req: AuthRequest, res: any, next: any): void {
  if (!req.user?.roles.includes('admin')) {
    res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
    return;
  }
  next();
}

// GET /api/users - List all users (Admin only)
router.get('/', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('[users] Error listing users:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// POST /api/users - Create new user (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const validated = CreateUserSchema.parse(req.body);

    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: validated.username },
    });

    if (existing) {
      return res.status(400).json({ error: 'username-taken', message: 'Username already exists' });
    }

    // Check if email already exists (if provided)
    if (validated.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: validated.email },
      });

      if (existingEmail) {
        return res.status(400).json({ error: 'email-taken', message: 'Email already exists' });
      }
    }

    const hashedPassword = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        username: validated.username,
        email: validated.email,
        password: hashedPassword,
        roles: validated.roles,
      },
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[users] Error creating user:', error);
    res.status(500).json({ error: 'create-failed' });
  }
});

// PATCH /api/users/:id - Update user (Admin only)
router.patch('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const validated = UpdateUserSchema.parse(req.body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'not-found', message: 'User not found' });
    }

    // Check if username is taken (if changing)
    if (validated.username && validated.username !== user.username) {
      const existing = await prisma.user.findUnique({
        where: { username: validated.username },
      });

      if (existing) {
        return res.status(400).json({ error: 'username-taken', message: 'Username already exists' });
      }
    }

    // Check if email is taken (if changing)
    if (validated.email && validated.email !== user.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: validated.email },
      });

      if (existingEmail) {
        return res.status(400).json({ error: 'email-taken', message: 'Email already exists' });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (validated.username) updateData.username = validated.username;
    if (validated.email !== undefined) updateData.email = validated.email;
    if (validated.roles) updateData.roles = validated.roles;
    if (validated.password) {
      updateData.password = await hashPassword(validated.password);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[users] Error updating user:', error);
    res.status(500).json({ error: 'update-failed' });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'cannot-delete-self', message: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'not-found', message: 'User not found' });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[users] Error deleting user:', error);
    res.status(500).json({ error: 'delete-failed' });
  }
});

export default router;
