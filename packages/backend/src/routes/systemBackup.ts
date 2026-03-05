import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../lib/auth.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { UPLOAD_DIR } from '../lib/upload.js';
import { broadcastScheduleUpdate, broadcastSettingsUpdate } from '../websocket/index.js';
import {
  normalizeScheduleData,
  readLocalVersion,
  compareVersions,
  parseDateOrFallback,
  sanitizeFilename,
  listUploadFiles,
  clearUploadDirectory,
  makeUniqueFilename,
} from '../lib/systemHelpers.js';

const router = Router();

interface BackupMediaItem {
  id?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size?: number;
  type: string;
  tags?: string[];
  uploadedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  dataBase64: string;
}

interface PreparedImportMedia {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  type: string;
  tags: string[];
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  buffer: Buffer;
}

const BackupMediaSchema = z.object({
  id: z.string().min(1).optional(),
  filename: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  type: z.string().min(1),
  tags: z.array(z.string()).default([]),
  uploadedBy: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  dataBase64: z.string().min(1),
});

const BackupPayloadSchema = z.object({
  formatVersion: z.union([z.literal(1), z.literal(2)]),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  checksum: z.string().optional(),
  mediaCount: z.number().optional(),
  schedule: ScheduleSchema,
  settings: z.record(z.string(), z.unknown()),
  media: z.array(BackupMediaSchema).default([]),
});

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname || '') || '.json';
      cb(null, `htmlsignage-backup-${suffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
  },
});

// GET /backup/export
router.get('/backup/export', async (_req: AuthRequest, res) => {
  try {
    const [scheduleRow, settingsRow, mediaRows] = await Promise.all([
      prisma.schedule.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      }),
      prisma.settings.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      }),
      prisma.media.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const schedule = normalizeScheduleData(scheduleRow?.data);
    const settings = (settingsRow?.data && typeof settingsRow.data === 'object')
      ? (settingsRow.data as Record<string, unknown>)
      : { version: 1 };

    const mediaResults = await Promise.all(
      mediaRows.map(async (item) => {
        const fullPath = path.join(UPLOAD_DIR, item.filename);
        if (!existsSync(fullPath)) {
          console.warn(`[system] Skipping missing media file during export: ${item.filename}`);
          return null;
        }
        const fileBuffer = await fs.readFile(fullPath);
        return {
          id: item.id,
          filename: item.filename,
          originalName: item.originalName,
          mimeType: item.mimeType,
          size: item.size,
          type: item.type,
          tags: item.tags,
          uploadedBy: item.uploadedBy,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          dataBase64: fileBuffer.toString('base64'),
        } satisfies BackupMediaItem;
      })
    );
    const media = mediaResults.filter((m) => m !== null) as BackupMediaItem[];

    const appVersion = await readLocalVersion();

    const payloadBase = {
      formatVersion: 2 as const,
      exportedAt: new Date().toISOString(),
      appVersion,
      mediaCount: media.length,
      schedule,
      settings,
      media,
    };

    const payloadJson = JSON.stringify(payloadBase);
    const checksum = crypto.createHash('sha256').update(payloadJson).digest('hex');
    const finalPayload = JSON.stringify({ ...payloadBase, checksum });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="htmlsignage-backup-${stamp}.json"`);
    res.status(200).send(finalPayload);
  } catch (error) {
    console.error('[system] Error exporting backup:', error);
    res.status(500).json({ error: 'backup-export-failed', message: 'Backup-Export fehlgeschlagen' });
  }
});

// POST /backup/import
router.post('/backup/import', backupUpload.single('backup'), async (req: AuthRequest, res) => {
  const filePath = req.file?.path;
  const replaceMedia = req.body?.replaceMedia !== 'false';

  if (!req.file || !filePath) {
    return res.status(400).json({ error: 'backup-file-required', message: 'Backup-Datei erforderlich' });
  }

  const writtenFiles: string[] = [];
  const warnings: string[] = [];

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsedJson = JSON.parse(raw) as unknown;
    const backup = BackupPayloadSchema.parse(parsedJson);

    if (backup.formatVersion === 2 && backup.checksum) {
      const { checksum: savedChecksum, ...payloadWithoutChecksum } = backup;
      const computed = crypto.createHash('sha256').update(JSON.stringify(payloadWithoutChecksum)).digest('hex');
      if (computed !== savedChecksum) {
        return res.status(400).json({ error: 'checksum-mismatch', message: 'Backup-Datei ist beschädigt (Checksum stimmt nicht überein).' });
      }
    }

    if (backup.appVersion) {
      const localVersion = await readLocalVersion();
      if (compareVersions(backup.appVersion, localVersion) > 0) {
        warnings.push(`Backup wurde mit einer neueren Version erstellt (${backup.appVersion} > ${localVersion}). Kompatibilitätsprobleme möglich.`);
      }
    }

    if (backup.mediaCount !== undefined && backup.mediaCount !== backup.media.length) {
      warnings.push(`Erwartete ${backup.mediaCount} Medien, aber ${backup.media.length} gefunden.`);
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const existingUsers = await prisma.user.findMany({ select: { id: true } });
    const validUserIds = new Set(existingUsers.map((user) => user.id));

    const usedFilenames = replaceMedia ? new Set<string>() : await listUploadFiles();
    const preparedMedia: PreparedImportMedia[] = backup.media.map((item) => {
      const safeFile = sanitizeFilename(item.filename || item.originalName);
      const filename = makeUniqueFilename(safeFile, usedFilenames);
      const buffer = Buffer.from(item.dataBase64, 'base64');
      const id = item.id && item.id.trim().length > 0
        ? item.id
        : `backup-media-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

      return {
        id,
        filename,
        originalName: item.originalName,
        mimeType: item.mimeType,
        type: item.type,
        tags: item.tags,
        uploadedBy: item.uploadedBy && validUserIds.has(item.uploadedBy) ? item.uploadedBy : null,
        createdAt: parseDateOrFallback(item.createdAt),
        updatedAt: parseDateOrFallback(item.updatedAt),
        buffer,
      };
    });

    if (replaceMedia) {
      await clearUploadDirectory();
    }

    await Promise.all(
      preparedMedia.map(async (item) => {
        const target = path.join(UPLOAD_DIR, item.filename);
        await fs.writeFile(target, item.buffer);
        writtenFiles.push(target);
      })
    );

    const importedSchedule = normalizeScheduleData(backup.schedule);
    const importedSettings = backup.settings;

    const result = await prisma.$transaction(async (tx) => {
      const [latestSchedule, latestSettings] = await Promise.all([
        tx.schedule.findFirst({ orderBy: { version: 'desc' } }),
        tx.settings.findFirst({ orderBy: { version: 'desc' } }),
      ]);

      const nextScheduleVersion = (latestSchedule?.version ?? 0) + 1;
      const nextSettingsVersion = (latestSettings?.version ?? 0) + 1;

      const scheduleToStore = { ...importedSchedule, version: nextScheduleVersion };
      const settingsToStore = { ...(importedSettings as Record<string, unknown>), version: nextSettingsVersion };

      const [newSchedule, newSettings] = await Promise.all([
        tx.schedule.create({ data: { version: nextScheduleVersion, isActive: true, data: scheduleToStore } }),
        tx.settings.create({ data: { version: nextSettingsVersion, isActive: true, data: settingsToStore } }),
      ]);

      await Promise.all([
        tx.schedule.updateMany({ where: { id: { not: newSchedule.id }, isActive: true }, data: { isActive: false } }),
        tx.settings.updateMany({ where: { id: { not: newSettings.id }, isActive: true }, data: { isActive: false } }),
      ]);

      if (replaceMedia) {
        await tx.media.deleteMany({});
      }

      const existingMediaIds = new Set(
        (await tx.media.findMany({ select: { id: true } })).map((m) => m.id)
      );

      for (const mediaItem of preparedMedia) {
        const mediaId = existingMediaIds.has(mediaItem.id)
          ? `backup-media-${Date.now()}-${Math.round(Math.random() * 1e9)}`
          : mediaItem.id;

        await tx.media.create({
          data: {
            id: mediaId,
            filename: mediaItem.filename,
            originalName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            size: mediaItem.buffer.length,
            type: mediaItem.type,
            tags: mediaItem.tags,
            uploadedBy: mediaItem.uploadedBy,
            createdAt: mediaItem.createdAt,
            updatedAt: mediaItem.updatedAt,
          },
        });
      }

      return {
        schedule: scheduleToStore,
        settings: settingsToStore,
        scheduleVersion: nextScheduleVersion,
        settingsVersion: nextSettingsVersion,
      };
    });

    broadcastScheduleUpdate(result.schedule);
    broadcastSettingsUpdate(result.settings);

    return res.json({
      ok: true,
      importedMedia: preparedMedia.length,
      replaceMedia,
      importedAt: new Date().toISOString(),
      importedScheduleVersion: result.scheduleVersion,
      importedSettingsVersion: result.settingsVersion,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    await Promise.all(
      writtenFiles.map((f) => fs.unlink(f).catch(() => {}))
    );

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'invalid-backup-format',
        details: error.errors,
      });
    }
    console.error('[system] Error importing backup:', error);
    return res.status(500).json({ error: 'backup-import-failed', message: 'Backup-Import fehlgeschlagen' });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors.
    }
  }
});

export default router;
