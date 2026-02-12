import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { upload, UPLOAD_DIR } from '../lib/upload.js';
import fs from 'fs';
import path from 'path';

const router = Router();

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
    const { type, search } = req.query;

    const where: any = {};

    if (type && typeof type === 'string') {
      where.type = type;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
      ];
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
    res.status(500).json({ error: 'fetch-failed' });
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
      return res.status(404).json({ error: 'not-found' });
    }

    res.json({
      ...media,
      url: `/uploads/${media.filename}`,
    });
  } catch (error) {
    console.error('[media] Error fetching media:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// POST /api/media/upload - Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'no-file-uploaded' });
    }

    const mediaType = getMediaType(req.file.mimetype);

    const media = await prisma.media.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        type: mediaType,
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

    res.status(500).json({ error: 'upload-failed' });
  }
});

// DELETE /api/media/:id - Delete media
router.delete('/:id', async (req, res) => {
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });

    if (!media) {
      return res.status(404).json({ error: 'not-found' });
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
    res.status(500).json({ error: 'delete-failed' });
  }
});

export default router;
