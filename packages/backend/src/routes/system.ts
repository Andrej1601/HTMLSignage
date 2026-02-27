import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../lib/auth.js';
import { ScheduleSchema, type DaySchedule, type PresetKey, type Schedule } from '../types/schedule.types.js';
import { UPLOAD_DIR } from '../lib/upload.js';
import { broadcastScheduleUpdate, broadcastSettingsUpdate } from '../websocket/index.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const PRESET_KEYS: PresetKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2'];
const DEFAULT_SAUNAS = ['Vulkan', 'Nordisch', 'Bio'];
const MAX_UPDATE_LOG_CHARS = 200_000;

let isUpdateRunning = false;

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface ReleaseInfo {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
}

interface GitHubApiRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
}

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
  settings: z.record(z.any()),
  media: z.array(BackupMediaSchema).default([]),
});

function createEmptyDaySchedule(saunas: string[] = DEFAULT_SAUNAS): DaySchedule {
  return {
    saunas: [...saunas],
    rows: [],
  };
}

function createDefaultSchedule(version = 1): Schedule {
  const presets = Object.fromEntries(
    PRESET_KEYS.map((key) => [key, createEmptyDaySchedule()])
  ) as Record<PresetKey, DaySchedule>;

  return {
    version: Math.max(1, Math.floor(version)),
    presets,
    autoPlay: false,
  };
}

function normalizeScheduleData(raw: unknown): Schedule {
  const parsed = ScheduleSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const maybeVersion = (raw as { version?: unknown } | null)?.version;
  const version = typeof maybeVersion === 'number' && Number.isFinite(maybeVersion) ? maybeVersion : 1;
  return createDefaultSchedule(version);
}

function trimLog(value: string): string {
  if (value.length <= MAX_UPDATE_LOG_CHARS) return value;
  return value.slice(value.length - MAX_UPDATE_LOG_CHARS);
}

async function runCommand(command: string, args: string[], cwd = REPO_ROOT): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout = trimLog(stdout + chunk.toString());
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr = trimLog(stderr + chunk.toString());
    });

    child.on('error', (error) => {
      stderr = trimLog(`${stderr}\n${String(error)}`);
      resolve({ code: 1, stdout, stderr });
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseVersion(tag: string): number[] {
  return tag.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function readLocalVersion(): Promise<string> {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version || '0.0.0';
}

async function checkDirtyTree(): Promise<boolean> {
  const dirtyResult = await runCommand('git', ['status', '--porcelain']);
  const dirtyLines = dirtyResult.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const trackedDirtyLines = dirtyLines.filter((line) => !line.startsWith('?? '));
  return dirtyResult.code === 0 && trackedDirtyLines.length > 0;
}

async function fetchGitHubReleases(): Promise<ReleaseInfo[]> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    console.warn('[system] GITHUB_TOKEN or GITHUB_REPO not configured');
    return [];
  }

  const url = `https://api.github.com/repos/${repo}/releases?per_page=50`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'HTMLSignage-Updater',
    },
  });

  if (!response.ok) {
    console.error(`[system] GitHub API error: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as GitHubApiRelease[];
  return data
    .filter((r) => !r.draft)
    .map((r) => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      body: r.body || '',
      publishedAt: r.published_at || '',
      prerelease: r.prerelease,
    }));
}

const BACKUP_DIR = path.join(REPO_ROOT, 'backups');

async function createDatabaseBackup(): Promise<string | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `db-backup-${stamp}.sql`);

  const result = await runCommand('pg_dump', ['--clean', '--if-exists', '-f', backupFile], REPO_ROOT);
  if (result.code !== 0) {
    console.error('[system] pg_dump failed:', result.stderr);
    return null;
  }
  return backupFile;
}

async function getCurrentGitTag(): Promise<string | null> {
  const result = await runCommand('git', ['describe', '--tags', '--exact-match', 'HEAD']);
  return result.code === 0 ? result.stdout.trim() : null;
}

function parseDateOrFallback(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function sanitizeFilename(value: string): string {
  const file = path.basename(value || '').trim();
  if (!file) return 'media-file';
  return file.replace(/[^\w.\-()+]/g, '_');
}

async function listUploadFiles(): Promise<Set<string>> {
  const names = new Set<string>();
  if (!existsSync(UPLOAD_DIR)) return names;
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isFile()) names.add(entry.name);
  });
  return names;
}

async function clearUploadDirectory(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) return;
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => fs.unlink(path.join(UPLOAD_DIR, entry.name)))
  );
}

function makeUniqueFilename(baseName: string, used: Set<string>): string {
  const parsed = path.parse(baseName);
  const stem = parsed.name || 'media-file';
  const ext = parsed.ext || '';

  let candidate = `${stem}${ext}`;
  let index = 1;
  while (used.has(candidate) || existsSync(path.join(UPLOAD_DIR, candidate))) {
    candidate = `${stem}-${index}${ext}`;
    index += 1;
  }

  used.add(candidate);
  return candidate;
}

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

// All routes require admin authentication.
router.use(authMiddleware, requireRole('admin'));

// GET /api/system/update/status — Release-basiert
router.get('/update/status', async (_req: AuthRequest, res) => {
  try {
    const [currentVersion, releases, isDirty] = await Promise.all([
      readLocalVersion(),
      fetchGitHubReleases(),
      checkDirtyTree(),
    ]);

    const stableReleases = releases.filter((r) => !r.prerelease);
    const latestRelease = stableReleases.length > 0 ? stableReleases[0] : null;
    const hasUpdate = latestRelease ? compareVersions(latestRelease.tag, currentVersion) > 0 : false;

    const olderReleases = stableReleases.slice(1).filter(
      (r) => compareVersions(r.tag, currentVersion) < 0
    );

    res.json({
      ok: true,
      currentVersion,
      latestRelease,
      hasUpdate,
      olderReleases,
      isDirty,
      isRunning: isUpdateRunning,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[system] Error checking update status:', error);
    res.status(500).json({ error: 'status-check-failed' });
  }
});

// POST /api/system/update/run — Target-Version basiert
const UpdateRunSchema = z.object({
  targetVersion: z.string().min(1),
});

router.post('/update/run', async (req: AuthRequest, res) => {
  if (isUpdateRunning) {
    return res.status(409).json({ error: 'update-in-progress' });
  }

  const parsed = UpdateRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid-request', details: parsed.error.errors });
  }

  const { targetVersion } = parsed.data;
  const tagName = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;

  isUpdateRunning = true;
  const logChunks: string[] = [];

  const appendLog = (chunk: string) => {
    logChunks.push(chunk.trimEnd());
    const combined = trimLog(logChunks.join('\n\n'));
    logChunks.length = 0;
    logChunks.push(combined);
  };

  try {
    const isDirty = await checkDirtyTree();
    if (isDirty) {
      appendLog('Working tree has local changes. Aborting update to avoid conflicts.');
      return res.status(409).json({ error: 'working-tree-dirty', log: logChunks[0] || '' });
    }

    // Save current tag for rollback
    const previousTag = await getCurrentGitTag();

    // Create database backup before update
    appendLog('== Erstelle Datenbank-Backup ==');
    const backupPath = await createDatabaseBackup();
    if (backupPath) {
      appendLog(`DB-Backup erstellt: ${path.basename(backupPath)}`);
    } else {
      appendLog('Warnung: DB-Backup konnte nicht erstellt werden. Update wird fortgesetzt.');
    }

    const steps: Array<{ label: string; command: string; args: string[] }> = [
      { label: 'Fetching tags and branches', command: 'git', args: ['fetch', '--all', '--tags', '--prune'] },
      { label: `Checking out ${tagName}`, command: 'git', args: ['checkout', tagName] },
      {
        label: 'Installing dependencies',
        command: 'pnpm',
        args: ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'],
      },
      { label: 'Applying Prisma migrations', command: 'pnpm', args: ['--filter', 'backend', 'prisma', 'migrate', 'deploy'] },
      { label: 'Building backend', command: 'pnpm', args: ['--filter', 'backend', 'build'] },
      { label: 'Building frontend', command: 'pnpm', args: ['--filter', 'frontend', 'build'] },
    ];

    let rolledBack = false;

    for (const step of steps) {
      appendLog(`== ${step.label} ==`);
      const result = await runCommand(step.command, step.args);
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combinedOutput) {
        appendLog(combinedOutput);
      }

      if (result.code !== 0) {
        // Attempt rollback if we have a previous tag
        if (previousTag) {
          appendLog(`\n== Rollback auf ${previousTag} ==`);
          const rollbackResult = await runCommand('git', ['checkout', previousTag]);
          if (rollbackResult.code === 0) {
            await runCommand('pnpm', ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false']);
            await runCommand('pnpm', ['--filter', 'backend', 'build']);
            await runCommand('pnpm', ['--filter', 'frontend', 'build']);
            appendLog(`Rollback auf ${previousTag} erfolgreich.`);
            rolledBack = true;
          } else {
            appendLog('Rollback fehlgeschlagen. Manueller Eingriff erforderlich.');
          }
        }

        return res.status(500).json({
          error: 'update-step-failed',
          step: step.label,
          log: logChunks[0] || '',
          backupPath: backupPath ? path.basename(backupPath) : undefined,
          rolledBack,
        });
      }
    }

    const newVersion = await readLocalVersion();
    return res.json({
      ok: true,
      newVersion,
      targetVersion: tagName,
      log: logChunks[0] || '',
      finishedAt: new Date().toISOString(),
      note: 'Update abgeschlossen. Bitte Backend-/Frontend-Dienste neu starten.',
      backupPath: backupPath ? path.basename(backupPath) : undefined,
    });
  } catch (error) {
    console.error('[system] Error running update:', error);
    appendLog(`Unexpected error: ${String(error)}`);
    return res.status(500).json({ error: 'update-failed', log: logChunks[0] || '' });
  } finally {
    isUpdateRunning = false;
  }
});

// GET /api/system/backup/export
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

    // Read media files in parallel
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

    // Build payload without checksum first, then compute
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
    res.status(500).json({ error: 'backup-export-failed' });
  }
});

// POST /api/system/backup/import
router.post('/backup/import', backupUpload.single('backup'), async (req: AuthRequest, res) => {
  const filePath = req.file?.path;
  const replaceMedia = req.body?.replaceMedia !== 'false';

  if (!req.file || !filePath) {
    return res.status(400).json({ error: 'backup-file-required' });
  }

  const writtenFiles: string[] = [];
  const warnings: string[] = [];

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsedJson = JSON.parse(raw) as unknown;
    const backup = BackupPayloadSchema.parse(parsedJson);

    // Checksum validation for formatVersion 2
    if (backup.formatVersion === 2 && backup.checksum) {
      const { checksum: savedChecksum, ...payloadWithoutChecksum } = backup;
      const computed = crypto.createHash('sha256').update(JSON.stringify(payloadWithoutChecksum)).digest('hex');
      if (computed !== savedChecksum) {
        return res.status(400).json({ error: 'checksum-mismatch', message: 'Backup-Datei ist beschädigt (Checksum stimmt nicht überein).' });
      }
    }

    // Version compatibility warning
    if (backup.appVersion) {
      const localVersion = await readLocalVersion();
      if (compareVersions(backup.appVersion, localVersion) > 0) {
        warnings.push(`Backup wurde mit einer neueren Version erstellt (${backup.appVersion} > ${localVersion}). Kompatibilitätsprobleme möglich.`);
      }
    }

    // Media count quick-validation
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

    // Write media files in parallel
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

      // Batch-check existing IDs to avoid N+1
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
    // Clean up written media files on failure
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
    return res.status(500).json({ error: 'backup-import-failed' });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore cleanup errors.
    }
  }
});

export default router;
