import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { upload, UPLOAD_DIR } from '../lib/upload.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import fs from 'fs';
import path from 'path';

const router = Router();

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const rawTag of value) {
    if (typeof rawTag !== 'string') continue;
    const tag = rawTag.trim();
    if (!tag) continue;
    if (tag.length > 32) continue;
    unique.add(tag);
    if (unique.size >= 20) break;
  }
  return [...unique];
}

// Helper to determine media type
function getMediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'other';
}

// GET /api/media - List all media
router.get('/', async (req, res) => {
  try {
    const { type, search, tag } = req.query;

    const where: {
      type?: string;
      tags?: { has: string };
      OR?: Array<{
        filename?: { contains: string; mode: 'insensitive' };
        originalName?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    if (type && typeof type === 'string') {
      where.type = type;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tag && typeof tag === 'string') {
      const cleanedTag = tag.trim();
      if (cleanedTag) {
        where.tags = { has: cleanedTag };
      }
    }

    const media = await prisma.media.findMany({
      where,
      include: {
        user: {
          select: { username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add URL to each media item
    const mediaWithUrls = media.map((item) => ({
      ...item,
      url: `/uploads/${item.filename}`,
    }));

    res.json(mediaWithUrls);
  } catch (error) {
    console.error('[media] Error listing media:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Medien konnten nicht geladen werden' });
  }
});

// GET /api/media/tags - List distinct tags
router.get('/tags', async (_req, res) => {
  try {
    const rows = await prisma.media.findMany({
      select: { tags: true },
    });

    const tagSet = new Set<string>();
    for (const row of rows) {
      for (const tag of row.tags || []) {
        const cleaned = tag.trim();
        if (!cleaned) continue;
        tagSet.add(cleaned);
      }
    }

    const tags = [...tagSet].sort((a, b) => a.localeCompare(b, 'de'));
    res.json(tags);
  } catch (error) {
    console.error('[media] Error listing media tags:', error);
    res.status(500).json({ error: 'fetch-tags-failed', message: 'Tags konnten nicht geladen werden' });
  }
});

// GET /api/media/:id - Get single media item
router.get('/:id', async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    if (!media) {
      return res.status(404).json({ error: 'not-found', message: 'Medium nicht gefunden' });
    }

    res.json({
      ...media,
      url: `/uploads/${media.filename}`,
    });
  } catch (error) {
    console.error('[media] Error fetching media:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Medien konnten nicht geladen werden' });
  }
});

// POST /api/media/upload - Upload file (auth required)
router.post('/upload', authMiddleware, mutationLimiter, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no-file-uploaded', message: 'Keine Datei hochgeladen' });
    }

    const mediaType = getMediaType(req.file.mimetype);

    const parsedTags = normalizeTags(req.body?.tags);
    const media = await prisma.media.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: mediaType,
        tags: parsedTags,
      },
    });

    res.json({
      ...media,
      url: `/uploads/${media.filename}`,
    });
  } catch (error) {
    console.error('[media] Error uploading file:', error);

    // Clean up uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[media] Error deleting file after error:', unlinkError);
      }
    }

    res.status(500).json({ error: 'upload-failed', message: 'Upload fehlgeschlagen' });
  }
});

// PATCH /api/media/:id/tags - Update media tags (auth required)
router.patch('/:id/tags', authMiddleware, mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const tags = normalizeTags(req.body?.tags);
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: { tags },
      include: {
        user: {
          select: { username: true },
        },
      },
    });

    res.json({
      ...media,
      url: `/uploads/${media.filename}`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'not-found', message: 'Medium nicht gefunden' });
    }
    console.error('[media] Error updating media tags:', error);
    res.status(500).json({ error: 'update-tags-failed', message: 'Tags konnten nicht aktualisiert werden' });
  }
});

// DELETE /api/media/:id - Delete media (auth required)
router.delete('/:id', authMiddleware, mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });

    if (!media) {
      return res.status(404).json({ error: 'not-found', message: 'Medium nicht gefunden' });
    }

    // Delete file from filesystem
    const filePath = path.join(UPLOAD_DIR, media.filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsError) {
      console.error('[media] Error deleting file from disk:', fsError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await prisma.media.delete({
      where: { id: req.params.id },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[media] Error deleting media:', error);
    res.status(500).json({ error: 'delete-failed', message: 'Medium konnte nicht gelöscht werden' });
  }
});

export default router;
