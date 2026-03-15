import { Router, type NextFunction, type Response } from 'express';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import multer from 'multer';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../lib/auth.js';
import { logAuditEvent } from '../lib/audit.js';
import { createSystemJob, findRunningSystemJob, runSystemJob } from '../lib/systemJobs.js';
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
  makeUniqueFilename,
} from '../lib/systemHelpers.js';

const router = Router();
const BACKUP_ZIP_FORMAT_VERSION = 3;

interface ZipEntry {
  path: string;
  type: 'File' | 'Directory';
  buffer: () => Promise<Buffer>;
  stream: () => NodeJS.ReadableStream;
}

interface ZipDirectory {
  files: ZipEntry[];
}

type ZipBackupManifest = z.infer<typeof ZipBackupManifestSchema>;
type BackupManifestMediaItem = z.infer<typeof BackupManifestMediaSchema>;

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
  size: number;
  sourcePath: string;
}

interface BackupPreviewMediaItem {
  originalName: string;
  filename: string;
  type: string;
  size: number;
  tags: string[];
  willRename: boolean;
  uploadedByMissing: boolean;
}

interface BackupImportPreviewResponse {
  ok: true;
  backup: {
    formatVersion: number;
    exportedAt: string;
    appVersion: string | null;
    mediaCount: number;
    checksumValid: boolean;
  };
  current: {
    appVersion: string;
    scheduleVersion: number | null;
    settingsVersion: number | null;
    mediaCount: number;
  };
  importPlan: {
    replaceMedia: boolean;
    importedMedia: number;
    scheduleWillReplace: boolean;
    settingsWillReplace: boolean;
    renamedMediaFiles: number;
  };
  conflicts: {
    mediaIdConflicts: number;
    filenameConflicts: number;
    missingUsers: number;
  };
  previewMedia: BackupPreviewMediaItem[];
  warnings: string[];
}

const BackupManifestMediaSchema = z.object({
  id: z.string().min(1).optional(),
  filename: z.string().min(1),
  originalName: z.string().min(1),
  archivePath: z.string().min(1).optional(),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  type: z.string().min(1),
  tags: z.array(z.string()).default([]),
  uploadedBy: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const ZipBackupManifestSchema = z.object({
  formatVersion: z.literal(BACKUP_ZIP_FORMAT_VERSION),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  checksum: z.string().optional(),
  mediaCount: z.number().optional(),
  schedule: ScheduleSchema,
  settings: z.record(z.string(), z.unknown()),
  media: z.array(BackupManifestMediaSchema).default([]),
});

const backupUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname || '') || '.zip';
      cb(null, `htmlsignage-backup-${suffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = (file.originalname || '').toLowerCase();
    const isZip = lowerName.endsWith('.zip')
      || file.mimetype === 'application/zip'
      || file.mimetype === 'application/x-zip-compressed'
      || (file.mimetype === 'application/octet-stream' && lowerName.endsWith('.zip'));

    if (isZip) {
      cb(null, true);
      return;
    }

    cb(new Error('Nur ZIP-Backups sind erlaubt.'));
  },
});

const backupUploadMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  backupUpload.fields([
    { name: 'backup', maxCount: 1 },
    { name: 'backupFile', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const message = error instanceof Error ? error.message : 'Backup-Datei konnte nicht verarbeitet werden.';
    res.status(400).json({
      error: 'invalid-backup-upload',
      message,
    });
  });
};

function resolveBackupFile(req: AuthRequest): Express.Multer.File | undefined {
  if (req.file) return req.file;
  const files = req.files as Record<string, Express.Multer.File[]> | Express.Multer.File[] | undefined;
  if (!files) return undefined;
  if (Array.isArray(files)) return files[0];
  return files.backup?.[0] || files.backupFile?.[0] || files.file?.[0];
}

function createBackupChecksum(payload: Omit<ZipBackupManifest, 'checksum'>): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function normalizeBackupWarnings(
  backup: Pick<ZipBackupManifest, 'appVersion' | 'mediaCount' | 'media'>,
  warnings: string[],
): void {
  if (backup.appVersion) {
    warnings.push(`backup-version:${backup.appVersion}`);
  }

  if (backup.mediaCount !== undefined && backup.mediaCount !== backup.media.length) {
    warnings.push(`backup-media-count:${backup.mediaCount}:${backup.media.length}`);
  }
}

function createPreparedMediaRecord(
  item: BackupManifestMediaItem,
  validUserIds: Set<string>,
  usedFilenames: Set<string>,
  replaceMedia: boolean,
  sourcePath: string,
  size: number,
): PreparedImportMedia {
  const safeFile = sanitizeFilename(item.filename || item.originalName);
  const filename = makeUniqueFilename(safeFile, usedFilenames, {
    checkUploadDir: !replaceMedia,
  });
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
    size,
    sourcePath,
  };
}

async function readZipManifest(filePath: string): Promise<ZipBackupManifest> {
  const directory = await unzipper.Open.file(filePath) as ZipDirectory;
  const manifestEntry = directory.files.find((entry) => entry.path === 'manifest.json');
  if (!manifestEntry) {
    throw new Error('manifest-missing');
  }

  const manifestRaw = (await manifestEntry.buffer()).toString('utf-8');
  const parsed = JSON.parse(manifestRaw) as unknown;
  return ZipBackupManifestSchema.parse(parsed);
}

async function prepareZipMedia(
  filePath: string,
  manifest: ZipBackupManifest,
  validUserIds: Set<string>,
  usedFilenames: Set<string>,
  replaceMedia: boolean,
  tempDir: string,
): Promise<PreparedImportMedia[]> {
  const directory = await unzipper.Open.file(filePath) as ZipDirectory;
  const entries = new Map(directory.files.map((entry) => [entry.path, entry]));
  const prepared: PreparedImportMedia[] = [];

  for (const item of manifest.media) {
    const archivePath = item.archivePath || `media/${item.filename}`;
    const entry = entries.get(archivePath);
    if (!entry || entry.type !== 'File') {
      throw new Error(`media-entry-missing:${archivePath}`);
    }

    const tempPath = path.join(tempDir, `${crypto.randomUUID()}-${sanitizeFilename(item.filename || item.originalName)}`);
    await pipeline(entry.stream(), createWriteStream(tempPath));
    const stats = await fs.stat(tempPath);
    prepared.push(createPreparedMediaRecord(item, validUserIds, usedFilenames, replaceMedia, tempPath, stats.size));
  }

  return prepared;
}

async function inspectZipMedia(
  filePath: string,
  manifest: ZipBackupManifest,
  validUserIds: Set<string>,
  existingMediaIds: Set<string>,
  existingFilenames: Set<string>,
  replaceMedia: boolean,
): Promise<{
  previewMedia: BackupPreviewMediaItem[];
  renamedMediaFiles: number;
  filenameConflicts: number;
  mediaIdConflicts: number;
  missingUsers: number;
}> {
  const directory = await unzipper.Open.file(filePath) as ZipDirectory;
  const entries = new Map(directory.files.map((entry) => [entry.path, entry]));
  const usedFilenames = replaceMedia ? new Set<string>() : new Set(existingFilenames);
  const previewMedia: BackupPreviewMediaItem[] = [];
  let renamedMediaFiles = 0;
  let filenameConflicts = 0;
  let mediaIdConflicts = 0;
  let missingUsers = 0;

  for (const item of manifest.media) {
    const archivePath = item.archivePath || `media/${item.filename}`;
    const entry = entries.get(archivePath);
    if (!entry || entry.type !== 'File') {
      throw new Error(`media-entry-missing:${archivePath}`);
    }

    const safeFilename = sanitizeFilename(item.filename || item.originalName);
    const resolvedFilename = makeUniqueFilename(safeFilename, usedFilenames, {
      checkUploadDir: !replaceMedia,
    });
    const willRename = resolvedFilename !== safeFilename;
    const uploadedByMissing = Boolean(item.uploadedBy && !validUserIds.has(item.uploadedBy));
    const size = typeof item.size === 'number'
      ? item.size
      : Number((entry as { vars?: { uncompressedSize?: number } }).vars?.uncompressedSize ?? 0);

    if (willRename) {
      renamedMediaFiles += 1;
      filenameConflicts += 1;
    }
    if (item.id && existingMediaIds.has(item.id)) {
      mediaIdConflicts += 1;
    }
    if (uploadedByMissing) {
      missingUsers += 1;
    }

    if (previewMedia.length < 8) {
      previewMedia.push({
        originalName: item.originalName,
        filename: resolvedFilename,
        type: item.type,
        size,
        tags: item.tags,
        willRename,
        uploadedByMissing,
      });
    }
  }

  return {
    previewMedia,
    renamedMediaFiles,
    filenameConflicts,
    mediaIdConflicts,
    missingUsers,
  };
}

async function buildImportPreview(
  filePath: string,
  replaceMedia: boolean,
): Promise<BackupImportPreviewResponse> {
  const warnings: string[] = [];
  const [existingUsers, localVersion, latestSchedule, latestSettings, currentMedia] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    readLocalVersion(),
    prisma.schedule.findFirst({ orderBy: { version: 'desc' }, select: { version: true } }),
    prisma.settings.findFirst({ orderBy: { version: 'desc' }, select: { version: true } }),
    prisma.media.findMany({ select: { id: true, filename: true } }),
  ]);

  const validUserIds = new Set(existingUsers.map((user) => user.id));
  const existingMediaIds = new Set(currentMedia.map((item) => item.id));
  const existingFilenames = new Set(currentMedia.map((item) => item.filename));

  const manifest = await readZipManifest(filePath);
  let checksumValid = true;
  if (manifest.checksum) {
    const { checksum, ...manifestBase } = manifest;
    checksumValid = createBackupChecksum(manifestBase) === checksum;
    if (!checksumValid) {
      throw new Error('checksum-mismatch');
    }
  }

  normalizeBackupWarnings(manifest, warnings);

  const mediaInspection = await inspectZipMedia(
    filePath,
    manifest,
    validUserIds,
    existingMediaIds,
    existingFilenames,
    replaceMedia,
  );

  if (mediaInspection.missingUsers > 0) {
    warnings.push(`${mediaInspection.missingUsers} Benutzerreferenz(en) aus dem Backup existieren lokal nicht mehr.`);
  }

  return {
    ok: true,
    backup: {
      formatVersion: manifest.formatVersion,
      exportedAt: manifest.exportedAt,
      appVersion: manifest.appVersion || null,
      mediaCount: manifest.media.length,
      checksumValid,
    },
    current: {
      appVersion: localVersion,
      scheduleVersion: latestSchedule?.version ?? null,
      settingsVersion: latestSettings?.version ?? null,
      mediaCount: currentMedia.length,
    },
    importPlan: {
      replaceMedia,
      importedMedia: manifest.media.length,
      scheduleWillReplace: true,
      settingsWillReplace: true,
      renamedMediaFiles: mediaInspection.renamedMediaFiles,
    },
    conflicts: {
      mediaIdConflicts: mediaInspection.mediaIdConflicts,
      filenameConflicts: mediaInspection.filenameConflicts,
      missingUsers: mediaInspection.missingUsers,
    },
    previewMedia: mediaInspection.previewMedia,
    warnings: normalizeImportWarnings(warnings, localVersion),
  };
}

async function importBackupData(
  preparedMedia: PreparedImportMedia[],
  scheduleData: unknown,
  settingsData: Record<string, unknown>,
  replaceMedia: boolean,
  writtenFiles: string[],
) {
  const importedSchedule = normalizeScheduleData(scheduleData);
  const rollbackRoot = replaceMedia
    ? await fs.mkdtemp(path.join(os.tmpdir(), 'htmlsignage-backup-rollback-'))
    : null;
  const rollbackUploadsPath = rollbackRoot ? path.join(rollbackRoot, 'uploads') : null;

  try {
    if (replaceMedia) {
      if (existsSync(UPLOAD_DIR)) {
        await fs.rename(UPLOAD_DIR, rollbackUploadsPath!);
      }
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } else {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }

    await Promise.all(
      preparedMedia.map(async (item) => {
        const target = path.join(UPLOAD_DIR, item.filename);
        await fs.copyFile(item.sourcePath, target);
        writtenFiles.push(target);
      }),
    );

    const result = await prisma.$transaction(async (tx) => {
      const [latestSchedule, latestSettings] = await Promise.all([
        tx.schedule.findFirst({ orderBy: { version: 'desc' } }),
        tx.settings.findFirst({ orderBy: { version: 'desc' } }),
      ]);

      const nextScheduleVersion = (latestSchedule?.version ?? 0) + 1;
      const nextSettingsVersion = (latestSettings?.version ?? 0) + 1;

      const scheduleToStore = { ...importedSchedule, version: nextScheduleVersion };
      const settingsToStore = { ...settingsData, version: nextSettingsVersion };

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

      const existingMediaIds = new Set((await tx.media.findMany({ select: { id: true } })).map((media) => media.id));

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
            size: mediaItem.size,
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

    if (rollbackRoot) {
      await fs.rm(rollbackRoot, { recursive: true, force: true });
    }

    return result;
  } catch (error) {
    if (rollbackUploadsPath && existsSync(rollbackUploadsPath)) {
      await fs.rm(UPLOAD_DIR, { recursive: true, force: true }).catch(() => {});
      await fs.rename(rollbackUploadsPath, UPLOAD_DIR).catch(() => {});
      await fs.rm(rollbackRoot!, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }
}

function normalizeImportWarnings(warnings: string[], localVersion: string): string[] {
  return warnings.flatMap((warning) => {
    if (warning.startsWith('backup-version:')) {
      const backupVersion = warning.split(':')[1] || '';
      return compareVersions(backupVersion, localVersion) > 0
        ? [`Backup wurde mit einer neueren Version erstellt (${backupVersion} > ${localVersion}). Kompatibilitätsprobleme möglich.`]
        : [];
    }

    if (warning.startsWith('backup-media-count:')) {
      const [, expected, actual] = warning.split(':');
      return [`Erwartete ${expected} Medien, aber ${actual} gefunden.`];
    }

    return [warning];
  });
}

function parseReplaceMedia(raw: unknown): boolean {
  return !(
    raw === 'false'
    || raw === '0'
    || raw === false
  );
}

function createAuditRequestSnapshot(req: AuthRequest): AuthRequest {
  return {
    userId: req.userId,
    user: req.user,
    ip: req.ip,
    headers: {
      'user-agent': req.headers['user-agent'] || '',
    },
    requestId: req.requestId,
  } as AuthRequest;
}

router.get('/backup/export', async (_req: AuthRequest, res) => {
  try {
    const [scheduleRow, settingsRow, mediaRows, appVersion] = await Promise.all([
      prisma.schedule.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } }),
      prisma.settings.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } }),
      prisma.media.findMany({ orderBy: { createdAt: 'asc' } }),
      readLocalVersion(),
    ]);

    const schedule = normalizeScheduleData(scheduleRow?.data);
    const settings = (settingsRow?.data && typeof settingsRow.data === 'object')
      ? (settingsRow.data as Record<string, unknown>)
      : { version: 1 };

    const manifestMedia: BackupManifestMediaItem[] = [];
    for (const item of mediaRows) {
      const fullPath = path.join(UPLOAD_DIR, item.filename);
      if (!existsSync(fullPath)) {
        console.warn(`[system] Skipping missing media file during ZIP export: ${item.filename}`);
        continue;
      }

      manifestMedia.push({
        id: item.id,
        filename: item.filename,
        originalName: item.originalName,
        archivePath: `media/${item.filename}`,
        mimeType: item.mimeType,
        size: item.size,
        type: item.type,
        tags: item.tags,
        uploadedBy: item.uploadedBy,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    }

    const manifestBase: Omit<ZipBackupManifest, 'checksum'> = {
      formatVersion: BACKUP_ZIP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion,
      mediaCount: manifestMedia.length,
      schedule,
      settings,
      media: manifestMedia,
    };
    const manifest: ZipBackupManifest = { ...manifestBase, checksum: createBackupChecksum(manifestBase) };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="htmlsignage-backup-${stamp}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    const archiveDone = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', (error) => reject(error));
    });

    archive.pipe(res);
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    for (const item of manifest.media) {
      archive.append(createReadStream(path.join(UPLOAD_DIR, item.filename)), { name: item.archivePath || `media/${item.filename}` });
    }

    await archive.finalize();
    await archiveDone;
    await logAuditEvent(_req, {
      action: 'system.backup.export',
      details: {
        mediaCount: manifest.media.length,
        formatVersion: manifest.formatVersion,
      },
    });
  } catch (error) {
    console.error('[system] Error exporting backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'backup-export-failed', message: 'Backup-Export fehlgeschlagen' });
    } else {
      res.end();
    }
  }
});

router.post('/backup/import/preview', backupUploadMiddleware, async (req: AuthRequest, res) => {
  const backupFile = resolveBackupFile(req);
  const filePath = backupFile?.path;
  const replaceMediaRaw = req.body?.replaceMedia;
  const replaceMedia = !(
    replaceMediaRaw === 'false'
    || replaceMediaRaw === '0'
    || replaceMediaRaw === false
  );

  if (!backupFile || !filePath) {
    return res.status(400).json({ error: 'backup-file-required', message: 'Backup-Datei erforderlich' });
  }

  try {
    const preview = await buildImportPreview(filePath, replaceMedia);
    await logAuditEvent(req, {
      action: 'system.backup.preview',
      details: {
        fileName: backupFile.originalname,
        replaceMedia,
        importedMedia: preview.importPlan.importedMedia,
      },
    });
    return res.json(preview);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        error: 'invalid-backup-json',
        message: 'manifest.json enthält ungültiges JSON.',
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'invalid-backup-format',
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message === 'manifest-missing') {
      return res.status(400).json({
        error: 'invalid-backup-format',
        message: 'ZIP-Backup enthält keine manifest.json.',
      });
    }

    if (error instanceof Error && error.message === 'checksum-mismatch') {
      return res.status(400).json({
        error: 'checksum-mismatch',
        message: 'Backup-Datei ist beschädigt (Checksum stimmt nicht überein).',
      });
    }

    if (error instanceof Error && error.message.startsWith('media-entry-missing:')) {
      const archivePath = error.message.split(':').slice(1).join(':');
      return res.status(400).json({
        error: 'backup-media-missing',
        message: `Medien-Datei fehlt im Backup: ${archivePath}`,
      });
    }

    console.error('[system] Error previewing backup import:', error);
    return res.status(500).json({ error: 'backup-preview-failed', message: 'Backup-Vorschau fehlgeschlagen' });
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
});

router.post('/backup/import', backupUploadMiddleware, async (req: AuthRequest, res) => {
  const backupFile = resolveBackupFile(req);
  const filePath = backupFile?.path;
  const replaceMedia = parseReplaceMedia(req.body?.replaceMedia);

  if (!backupFile || !filePath) {
    return res.status(400).json({
      error: 'backup-file-required',
      message: 'Backup-Datei erforderlich',
      requestId: req.requestId ?? null,
    });
  }

  const runningJob = findRunningSystemJob('backup-import');
  if (runningJob) {
    return res.status(409).json({
      error: 'backup-import-in-progress',
      message: 'Ein Backup-Import läuft bereits',
      job: runningJob,
      requestId: req.requestId ?? null,
    });
  }

  const auditRequest = createAuditRequestSnapshot(req);
  const job = createSystemJob({
    type: 'backup-import',
    title: `Backup importieren: ${backupFile.originalname}`,
    requestId: req.requestId ?? null,
    createdBy: req.user
      ? {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
        }
      : null,
  });

  runSystemJob(job.id, async (context) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'htmlsignage-backup-import-'));
    const warnings: string[] = [];
    const writtenFiles: string[] = [];

    try {
      context.setProgress('prepare', 'Backup wird validiert', 10);
      await fs.mkdir(UPLOAD_DIR, { recursive: true });

      const [existingUsers, localVersion] = await Promise.all([
        prisma.user.findMany({ select: { id: true } }),
        readLocalVersion(),
      ]);

      const validUserIds = new Set(existingUsers.map((user) => user.id));
      const usedFilenames = replaceMedia ? new Set<string>() : await listUploadFiles();

      const manifest = await readZipManifest(filePath);
      if (manifest.checksum) {
        const { checksum, ...manifestBase } = manifest;
        if (createBackupChecksum(manifestBase) !== checksum) {
          context.fail('checksum-mismatch', 'Backup-Datei ist beschädigt (Checksum stimmt nicht überein).');
          return;
        }
      }

      normalizeBackupWarnings(manifest, warnings);

      context.setProgress('media', 'Medien werden vorbereitet', 40);
      const preparedMedia = await prepareZipMedia(filePath, manifest, validUserIds, usedFilenames, replaceMedia, tempDir);

      context.setProgress('import', 'Backup wird eingespielt', 75);
      const result = await importBackupData(preparedMedia, manifest.schedule, manifest.settings, replaceMedia, writtenFiles);
      const normalizedWarnings = normalizeImportWarnings(warnings, localVersion);

      const successResult = {
        importedMedia: preparedMedia.length,
        replaceMedia,
        importedAt: new Date().toISOString(),
        importedScheduleVersion: result.scheduleVersion,
        importedSettingsVersion: result.settingsVersion,
        warnings: normalizedWarnings,
      };

      context.appendLog(`Backup importiert: ${preparedMedia.length} Medien, Plan v${result.scheduleVersion}, Settings v${result.settingsVersion}.`);
      context.succeed(successResult);

      await logAuditEvent(auditRequest, {
        action: 'system.backup.import',
        details: {
          fileName: backupFile.originalname,
          replaceMedia,
          importedMedia: preparedMedia.length,
          importedScheduleVersion: result.scheduleVersion,
          importedSettingsVersion: result.settingsVersion,
          warnings: normalizedWarnings,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
    } catch (error) {
      await Promise.all(writtenFiles.map((file) => fs.unlink(file).catch(() => {})));

      if (error instanceof SyntaxError) {
        context.fail('invalid-backup-json', 'manifest.json enthält ungültiges JSON.');
      } else if (error instanceof z.ZodError) {
        context.fail('invalid-backup-format', 'Backup-Format ist ungültig.', {
          details: error.errors,
        });
      } else if (error instanceof Error && error.message === 'manifest-missing') {
        context.fail('invalid-backup-format', 'ZIP-Backup enthält keine manifest.json.');
      } else if (error instanceof Error && error.message.startsWith('media-entry-missing:')) {
        const archivePath = error.message.split(':').slice(1).join(':');
        context.fail('backup-media-missing', `Medien-Datei fehlt im Backup: ${archivePath}`);
      } else {
        const message = error instanceof Error ? error.message : 'Backup-Import fehlgeschlagen';
        console.error('[system] Error importing backup:', error);
        context.fail('backup-import-failed', message);
      }

      await logAuditEvent(auditRequest, {
        action: 'system.backup.import.failed',
        details: {
          fileName: backupFile.originalname,
          replaceMedia,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
    } finally {
      await Promise.all([
        fs.unlink(filePath).catch(() => {}),
        fs.rm(tempDir, { recursive: true, force: true }).catch(() => {}),
      ]);
    }
  });

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    job,
    message: `Backup-Import für ${backupFile.originalname} wurde gestartet.`,
  });
});

export default router;
