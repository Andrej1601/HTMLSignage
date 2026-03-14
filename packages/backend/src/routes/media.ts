import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { upload, UPLOAD_DIR } from '../lib/upload.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileTypeFromFile } from 'file-type';

const router = Router();
const DEFAULT_MEDIA_LIMIT = 500;
const MAX_MEDIA_LIMIT = 2000;

const MIME_SIGNATURE_COMPATIBILITY: Record<string, string[]> = {
  'image/jpeg': ['image/jpeg'],
  'image/jpg': ['image/jpeg'],
  'image/png': ['image/png'],
  'image/gif': ['image/gif'],
  'image/webp': ['image/webp'],
  'audio/mpeg': ['audio/mpeg'],
  'audio/mp3': ['audio/mpeg'],
  'audio/wav': ['audio/wav'],
  'audio/ogg': ['audio/ogg'],
  'audio/webm': ['audio/webm'],
  'video/mp4': ['video/mp4'],
  'video/webm': ['video/webm'],
  'video/ogg': ['video/ogg'],
};

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

async function isLikelySvg(filePath: string): Promise<boolean> {
  try {
    const content = await fsPromises.readFile(filePath, 'utf-8');
    const head = content.slice(0, 2048).toLowerCase();
    return head.includes('<svg');
  } catch {
    return false;
  }
}

async function validateUploadedFile(file: Express.Multer.File): Promise<{
  ok: boolean;
  detectedMime?: string;
  message?: string;
}> {
  const incomingMime = file.mimetype.toLowerCase();
  const compatible = MIME_SIGNATURE_COMPATIBILITY[incomingMime];

  if (incomingMime === 'image/svg+xml') {
    const svgValid = await isLikelySvg(file.path);
    if (!svgValid) {
      return {
        ok: false,
        message: 'Dateiinhalt passt nicht zum angegebenen SVG-Dateityp.',
      };
    }
    return { ok: true, detectedMime: incomingMime };
  }

  if (!compatible) {
    return {
      ok: false,
      message: `Nicht unterstützter MIME-Type: ${incomingMime}`,
    };
  }

  const detected = await fileTypeFromFile(file.path);
  if (!detected?.mime) {
    return {
      ok: false,
      message: 'Dateityp konnte nicht sicher erkannt werden.',
    };
  }

  if (!compatible.includes(detected.mime)) {
    return {
      ok: false,
      message: `Dateiinhalt (${detected.mime}) passt nicht zum angegebenen Typ (${incomingMime}).`,
    };
  }

  return { ok: true, detectedMime: detected.mime };
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
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const parsedOffset = Number.parseInt(String(req.query.offset ?? ''), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_MEDIA_LIMIT)
      : DEFAULT_MEDIA_LIMIT;
    const offset = Number.isFinite(parsedOffset)
      ? Math.min(Math.max(parsedOffset, 0), 10_000)
      : 0;

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

    if (search && typeof search === 'string' && search.trim() !== '') {
      const normalizedSearch = search.trim().slice(0, 120);
      where.OR = [
        { filename: { contains: normalizedSearch, mode: 'insensitive' } },
        { originalName: { contains: normalizedSearch, mode: 'insensitive' } },
      ];
    }

    if (tag && typeof tag === 'string') {
      const cleanedTag = tag.trim();
      if (cleanedTag) {
        where.tags = { has: cleanedTag };
      }
    }

    const [media, totalCount] = await Promise.all([
      prisma.media.findMany({
        where,
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.media.count({ where }),
    ]);

    // Add URL to each media item
    const mediaWithUrls = media.map((item) => ({
      ...item,
      url: `/uploads/${item.filename}`,
    }));

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Result-Limit', String(limit));
    res.setHeader('X-Result-Offset', String(offset));
    res.json(mediaWithUrls);
  } catch (error) {
    console.error('[media] Error listing media:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Medien konnten nicht geladen werden' });
  }
});

// GET /api/media/tags - List distinct tags
router.get('/tags', async (_req, res) => {
  try {
    const rows = await prisma.$queryRaw<Array<{ tag: string | null }>>`
      SELECT DISTINCT unnest("tags") AS tag
      FROM "media"
      WHERE cardinality("tags") > 0
      ORDER BY 1 ASC
    `;
    const tags = rows
      .map((row) => row.tag?.trim() || '')
      .filter((tag) => tag.length > 0);
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
router.post('/upload', authMiddleware, requirePermission('media:manage'), mutationLimiter, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no-file-uploaded', message: 'Keine Datei hochgeladen' });
    }

    const signatureCheck = await validateUploadedFile(req.file);
    if (!signatureCheck.ok) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[media] Error deleting invalid upload:', unlinkError);
      }
      return res.status(400).json({
        error: 'invalid-file-content',
        message: signatureCheck.message || 'Dateiinhalt ungültig',
      });
    }

    const effectiveMimeType = signatureCheck.detectedMime || req.file.mimetype;
    const mediaType = getMediaType(effectiveMimeType);

    const parsedTags = normalizeTags(req.body?.tags);
    const media = await prisma.media.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: effectiveMimeType,
        size: req.file.size,
        type: mediaType,
        tags: parsedTags,
        uploadedBy: req.userId ?? null,
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
router.patch('/:id/tags', authMiddleware, requirePermission('media:manage'), mutationLimiter, async (req: AuthRequest, res) => {
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
router.delete('/:id', authMiddleware, requirePermission('media:manage'), mutationLimiter, async (req: AuthRequest, res) => {
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
