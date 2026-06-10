import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';

const router = Router();

const PaletteColorsSchema = z.object({
  bg: z.string(),
  fg: z.string(),
  accent: z.string(),
  gridTable: z.string(),
  cellBg: z.string(),
  boxFg: z.string(),
  timeColBg: z.string(),
  flame: z.string(),
  zebra1: z.string(),
  zebra2: z.string(),
  timeZebra1: z.string(),
  timeZebra2: z.string(),
  headRowBg: z.string(),
  headRowFg: z.string(),
  cornerBg: z.string(),
  cornerFg: z.string(),
}).catchall(z.unknown());

const CreatePaletteSchema = z.object({
  name: z.string().min(1).max(100),
  colors: PaletteColorsSchema,
});

// GET /api/palettes — list all custom palettes
router.get('/', asyncHandler(async (_req, res) => {
  const palettes = await prisma.customPalette.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json(palettes);
}));

// POST /api/palettes — create a new custom palette (auth required)
router.post('/', authMiddleware, requirePermission('settings:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const { name, colors } = CreatePaletteSchema.parse(req.body);
  const palette = await prisma.customPalette.create({
    data: { name, colors: colors as unknown as Prisma.InputJsonValue },
  });
  res.status(201).json(palette);
}));

// PUT /api/palettes/:id — update a custom palette (auth required)
router.put('/:id', authMiddleware, requirePermission('settings:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const { name, colors } = CreatePaletteSchema.parse(req.body);
  const palette = await prisma.customPalette.update({
    where: { id: str(req.params.id) },
    data: { name, colors: colors as unknown as Prisma.InputJsonValue },
  });
  res.json(palette);
}));

// DELETE /api/palettes/:id — delete a custom palette (auth required)
router.delete('/:id', authMiddleware, requirePermission('settings:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  await prisma.customPalette.delete({
    where: { id: str(req.params.id) },
  });
  res.json({ ok: true });
}));

export default router;
