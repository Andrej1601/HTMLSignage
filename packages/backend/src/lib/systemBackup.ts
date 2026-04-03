import { createWriteStream, existsSync } from 'fs';
import fs from 'fs/promises';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { UPLOAD_DIR } from './upload.js';
import { broadcastScheduleUpdate, broadcastSettingsUpdate } from '../websocket/index.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import {
  normalizeScheduleData,
} from './schedule.js';
import {
  readLocalVersion,
  compareVersions,
  parseDateOrFallback,
  sanitizeFilename,
  listUploadFiles,
  makeUniqueFilename,
} from './systemHelpers.js';

export const BACKUP_ZIP_FORMAT_VERSION = 3;

interface ZipEntry {
  path: string;
  type: 'File' | 'Directory';
  buffer: () => Promise<Buffer>;
  stream: () => NodeJS.ReadableStream;
}

interface ZipDirectory {
  files: ZipEntry[];
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

export type ZipBackupManifest = z.infer<typeof ZipBackupManifestSchema>;
export type BackupManifestMediaItem = z.infer<typeof BackupManifestMediaSchema>;

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

export interface BackupPreviewMediaItem {
  originalName: string;
  filename: string;
  type: string;
  size: number;
  tags: string[];
  willRename: boolean;
  uploadedByMissing: boolean;
}

export interface BackupImportPreviewResponse {
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

export interface BackupImportProgressReporter {
  setProgress: (stage: string, message: string, percent?: number) => void;
  appendLog: (chunk: string) => void;
}

export interface BackupImportResult extends Record<string, unknown> {
  importedMedia: number;
  replaceMedia: boolean;
  importedAt: string;
  importedScheduleVersion: number;
  importedSettingsVersion: number;
  warnings: string[];
}

export interface BackupOperationFailure {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

class BackupOperationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'BackupOperationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function createBackupMediaId(): string {
  return `backup-media-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
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
    : createBackupMediaId();

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

async function openZipDirectory(filePath: string): Promise<ZipDirectory> {
  return await unzipper.Open.file(filePath) as ZipDirectory;
}

function getZipEntries(directory: ZipDirectory): Map<string, ZipEntry> {
  return new Map(directory.files.map((entry) => [entry.path, entry]));
}

async function readZipManifestFromDirectory(directory: ZipDirectory): Promise<ZipBackupManifest> {
  const manifestEntry = directory.files.find((entry) => entry.path === 'manifest.json');
  if (!manifestEntry) {
    throw new BackupOperationError(
      'invalid-backup-format',
      'ZIP-Backup enthält keine manifest.json.',
      400,
    );
  }

  let parsed: unknown;
  try {
    const manifestRaw = (await manifestEntry.buffer()).toString('utf-8');
    parsed = JSON.parse(manifestRaw) as unknown;
  } catch {
    throw new BackupOperationError(
      'invalid-backup-json',
      'manifest.json enthält ungültiges JSON.',
      400,
    );
  }

  try {
    return ZipBackupManifestSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new BackupOperationError(
        'invalid-backup-format',
        'Backup-Format ist ungültig.',
        400,
        error.errors,
      );
    }
    throw error;
  }
}

function ensureBackupChecksum(manifest: ZipBackupManifest): boolean {
  if (!manifest.checksum) return true;
  const { checksum, ...manifestBase } = manifest;
  const checksumValid = createBackupChecksum(manifestBase) === checksum;
  if (!checksumValid) {
    throw new BackupOperationError(
      'checksum-mismatch',
      'Backup-Datei ist beschädigt (Checksum stimmt nicht überein).',
      400,
    );
  }
  return checksumValid;
}

function getRequiredMediaEntry(entries: Map<string, ZipEntry>, item: BackupManifestMediaItem): ZipEntry {
  const archivePath = item.archivePath || `media/${item.filename}`;
  const entry = entries.get(archivePath);
  if (!entry || entry.type !== 'File') {
    throw new BackupOperationError(
      'backup-media-missing',
      `Medien-Datei fehlt im Backup: ${archivePath}`,
      400,
      { archivePath },
    );
  }
  return entry;
}

async function prepareZipMedia(
  directory: ZipDirectory,
  manifest: ZipBackupManifest,
  validUserIds: Set<string>,
  usedFilenames: Set<string>,
  replaceMedia: boolean,
  tempDir: string,
): Promise<PreparedImportMedia[]> {
  const entries = getZipEntries(directory);
  const prepared: PreparedImportMedia[] = [];

  for (const item of manifest.media) {
    const entry = getRequiredMediaEntry(entries, item);
    const tempPath = path.join(tempDir, `${crypto.randomUUID()}-${sanitizeFilename(item.filename || item.originalName)}`);
    await pipeline(entry.stream(), createWriteStream(tempPath));
    const stats = await fs.stat(tempPath);
    prepared.push(createPreparedMediaRecord(item, validUserIds, usedFilenames, replaceMedia, tempPath, stats.size));
  }

  return prepared;
}

async function inspectZipMedia(
  directory: ZipDirectory,
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
  const entries = getZipEntries(directory);
  const usedFilenames = replaceMedia ? new Set<string>() : new Set(existingFilenames);
  const previewMedia: BackupPreviewMediaItem[] = [];
  let renamedMediaFiles = 0;
  let filenameConflicts = 0;
  let mediaIdConflicts = 0;
  let missingUsers = 0;

  for (const item of manifest.media) {
    const entry = getRequiredMediaEntry(entries, item);
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
          ? createBackupMediaId()
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

export function parseReplaceMedia(raw: unknown): boolean {
  return !(
    raw === 'false'
    || raw === '0'
    || raw === false
  );
}

export function getBackupOperationFailure(
  error: unknown,
  fallback: { code: string; message: string; status?: number },
): BackupOperationFailure {
  if (error instanceof BackupOperationError) {
    return {
      code: error.code,
      message: error.message,
      status: error.status,
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  }

  return {
    code: fallback.code,
    message: fallback.message,
    status: fallback.status ?? 500,
  };
}

export async function buildBackupExportManifest(): Promise<ZipBackupManifest> {
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

  return {
    ...manifestBase,
    checksum: createBackupChecksum(manifestBase),
  };
}

export async function buildImportPreview(
  filePath: string,
  replaceMedia: boolean,
): Promise<BackupImportPreviewResponse> {
  const warnings: string[] = [];
  const [existingUsers, localVersion, latestSchedule, latestSettings, currentMedia, directory] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    readLocalVersion(),
    prisma.schedule.findFirst({ orderBy: { version: 'desc' }, select: { version: true } }),
    prisma.settings.findFirst({ orderBy: { version: 'desc' }, select: { version: true } }),
    prisma.media.findMany({ select: { id: true, filename: true } }),
    openZipDirectory(filePath),
  ]);

  const validUserIds = new Set(existingUsers.map((user) => user.id));
  const existingMediaIds = new Set(currentMedia.map((item) => item.id));
  const existingFilenames = new Set(currentMedia.map((item) => item.filename));

  const manifest = await readZipManifestFromDirectory(directory);
  const checksumValid = ensureBackupChecksum(manifest);

  normalizeBackupWarnings(manifest, warnings);

  const mediaInspection = await inspectZipMedia(
    directory,
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

export async function importBackupArchive(
  filePath: string,
  replaceMedia: boolean,
  reporter?: BackupImportProgressReporter,
): Promise<BackupImportResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'htmlsignage-backup-import-'));
  const warnings: string[] = [];
  const writtenFiles: string[] = [];

  try {
    reporter?.setProgress('prepare', 'Backup wird validiert', 10);
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const [existingUsers, localVersion, directory] = await Promise.all([
      prisma.user.findMany({ select: { id: true } }),
      readLocalVersion(),
      openZipDirectory(filePath),
    ]);

    const validUserIds = new Set(existingUsers.map((user) => user.id));
    const usedFilenames = replaceMedia ? new Set<string>() : await listUploadFiles();

    const manifest = await readZipManifestFromDirectory(directory);
    ensureBackupChecksum(manifest);
    normalizeBackupWarnings(manifest, warnings);

    reporter?.setProgress('media', 'Medien werden vorbereitet', 40);
    const preparedMedia = await prepareZipMedia(
      directory,
      manifest,
      validUserIds,
      usedFilenames,
      replaceMedia,
      tempDir,
    );

    reporter?.setProgress('import', 'Backup wird eingespielt', 75);
    const result = await importBackupData(
      preparedMedia,
      manifest.schedule,
      manifest.settings,
      replaceMedia,
      writtenFiles,
    );
    const normalizedWarnings = normalizeImportWarnings(warnings, localVersion);
    reporter?.appendLog(`Backup importiert: ${preparedMedia.length} Medien, Plan v${result.scheduleVersion}, Settings v${result.settingsVersion}.`);

    return {
      importedMedia: preparedMedia.length,
      replaceMedia,
      importedAt: new Date().toISOString(),
      importedScheduleVersion: result.scheduleVersion,
      importedSettingsVersion: result.settingsVersion,
      warnings: normalizedWarnings,
    };
  } catch (error) {
    await Promise.all(writtenFiles.map((file) => fs.unlink(file).catch(() => {})));
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
