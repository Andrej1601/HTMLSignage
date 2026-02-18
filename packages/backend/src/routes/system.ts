import { Router } from 'express';
import { z } from 'zod';
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

interface UpdateStatusPayload {
  branch: string | null;
  currentCommit: string | null;
  remoteCommit: string | null;
  hasUpdate: boolean;
  isGitRepo: boolean;
  isDirty: boolean;
  isRunning: boolean;
}

interface BackupMediaItem {
  id?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size?: number;
  type: string;
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
  uploadedBy: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  dataBase64: z.string().min(1),
});

const BackupPayloadSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string(),
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

async function getGitUpdateStatus(): Promise<UpdateStatusPayload> {
  const insideRepo = await runCommand('git', ['rev-parse', '--is-inside-work-tree']);
  const isGitRepo = insideRepo.code === 0 && insideRepo.stdout.trim() === 'true';

  if (!isGitRepo) {
    return {
      branch: null,
      currentCommit: null,
      remoteCommit: null,
      hasUpdate: false,
      isGitRepo: false,
      isDirty: false,
      isRunning: isUpdateRunning,
    };
  }

  const branchResult = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchResult.code === 0 ? branchResult.stdout.trim() : null;

  const currentCommitResult = await runCommand('git', ['rev-parse', 'HEAD']);
  const currentCommit = currentCommitResult.code === 0 ? currentCommitResult.stdout.trim() : null;

  const dirtyResult = await runCommand('git', ['status', '--porcelain']);
  const isDirty = dirtyResult.code === 0 && dirtyResult.stdout.trim().length > 0;

  let remoteCommit: string | null = null;
  let hasUpdate = false;

  if (branch) {
    const fetchResult = await runCommand('git', ['fetch', 'origin', branch, '--prune']);
    if (fetchResult.code === 0) {
      const remoteCommitResult = await runCommand('git', ['rev-parse', `origin/${branch}`]);
      if (remoteCommitResult.code === 0) {
        remoteCommit = remoteCommitResult.stdout.trim();
        hasUpdate = Boolean(currentCommit && remoteCommit && currentCommit !== remoteCommit);
      }
    }
  }

  return {
    branch,
    currentCommit,
    remoteCommit,
    hasUpdate,
    isGitRepo: true,
    isDirty,
    isRunning: isUpdateRunning,
  };
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

// GET /api/system/update/status
router.get('/update/status', async (_req: AuthRequest, res) => {
  try {
    const status = await getGitUpdateStatus();
    res.json({
      ok: true,
      ...status,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[system] Error checking update status:', error);
    res.status(500).json({ error: 'status-check-failed' });
  }
});

// POST /api/system/update/run
router.post('/update/run', async (_req: AuthRequest, res) => {
  if (isUpdateRunning) {
    return res.status(409).json({ error: 'update-in-progress' });
  }

  isUpdateRunning = true;
  const logChunks: string[] = [];

  const appendLog = (chunk: string) => {
    logChunks.push(chunk.trimEnd());
    const combined = trimLog(logChunks.join('\n\n'));
    logChunks.length = 0;
    logChunks.push(combined);
  };

  try {
    const dirtyCheck = await runCommand('git', ['status', '--porcelain']);
    if (dirtyCheck.code !== 0) {
      appendLog(`git status failed:\n${dirtyCheck.stderr || dirtyCheck.stdout}`);
      return res.status(500).json({ error: 'git-status-failed', log: logChunks[0] || '' });
    }

    const dirtyLines = dirtyCheck.stdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean);
    const trackedDirtyLines = dirtyLines.filter((line) => !line.startsWith('?? '));

    if (trackedDirtyLines.length > 0) {
      appendLog('Working tree has local changes. Aborting update to avoid conflicts.');
      appendLog(trackedDirtyLines.join('\n'));
      return res.status(409).json({ error: 'working-tree-dirty', log: logChunks[0] || '' });
    }

    const steps: Array<{ label: string; command: string; args: string[] }> = [
      { label: 'Fetching latest git state', command: 'git', args: ['fetch', '--all', '--prune'] },
      { label: 'Pulling latest changes', command: 'git', args: ['pull', '--ff-only'] },
      {
        label: 'Installing dependencies',
        command: 'pnpm',
        args: ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'],
      },
      { label: 'Applying Prisma migrations', command: 'pnpm', args: ['--filter', 'backend', 'prisma', 'migrate', 'deploy'] },
      { label: 'Building backend', command: 'pnpm', args: ['--filter', 'backend', 'build'] },
      { label: 'Building frontend', command: 'pnpm', args: ['--filter', 'frontend', 'build'] },
    ];

    for (const step of steps) {
      appendLog(`== ${step.label} ==`);
      const result = await runCommand(step.command, step.args);
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combinedOutput) {
        appendLog(combinedOutput);
      }

      if (result.code !== 0) {
        return res.status(500).json({
          error: 'update-step-failed',
          step: step.label,
          log: logChunks[0] || '',
        });
      }
    }

    const status = await getGitUpdateStatus();
    return res.json({
      ok: true,
      status,
      log: logChunks[0] || '',
      finishedAt: new Date().toISOString(),
      note: 'Update finished. Restart backend/frontend services to activate new runtime.',
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

    const media: BackupMediaItem[] = [];
    for (const item of mediaRows) {
      const fullPath = path.join(UPLOAD_DIR, item.filename);
      if (!existsSync(fullPath)) {
        console.warn(`[system] Skipping missing media file during export: ${item.filename}`);
        continue;
      }

      const fileBuffer = await fs.readFile(fullPath);
      media.push({
        id: item.id,
        filename: item.filename,
        originalName: item.originalName,
        mimeType: item.mimeType,
        size: item.size,
        type: item.type,
        uploadedBy: item.uploadedBy,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        dataBase64: fileBuffer.toString('base64'),
      });
    }

    const payload = {
      formatVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      schedule,
      settings,
      media,
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="htmlsignage-backup-${stamp}.json"`);
    res.status(200).send(JSON.stringify(payload));
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

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsedJson = JSON.parse(raw) as unknown;
    const backup = BackupPayloadSchema.parse(parsedJson);

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
        uploadedBy: item.uploadedBy && validUserIds.has(item.uploadedBy) ? item.uploadedBy : null,
        createdAt: parseDateOrFallback(item.createdAt),
        updatedAt: parseDateOrFallback(item.updatedAt),
        buffer,
      };
    });

    if (replaceMedia) {
      await clearUploadDirectory();
    }

    for (const item of preparedMedia) {
      await fs.writeFile(path.join(UPLOAD_DIR, item.filename), item.buffer);
    }

    const importedSchedule = normalizeScheduleData(backup.schedule);
    const importedSettings = backup.settings;

    const result = await prisma.$transaction(async (tx) => {
      const latestSchedule = await tx.schedule.findFirst({
        orderBy: { version: 'desc' },
      });
      const nextScheduleVersion = (latestSchedule?.version ?? 0) + 1;
      const scheduleToStore = {
        ...importedSchedule,
        version: nextScheduleVersion,
      };

      const latestSettings = await tx.settings.findFirst({
        orderBy: { version: 'desc' },
      });
      const nextSettingsVersion = (latestSettings?.version ?? 0) + 1;
      const settingsToStore = {
        ...(importedSettings as Record<string, unknown>),
        version: nextSettingsVersion,
      };

      const newSchedule = await tx.schedule.create({
        data: {
          version: nextScheduleVersion,
          isActive: true,
          data: scheduleToStore,
        },
      });

      await tx.schedule.updateMany({
        where: {
          id: { not: newSchedule.id },
          isActive: true,
        },
        data: { isActive: false },
      });

      const newSettings = await tx.settings.create({
        data: {
          version: nextSettingsVersion,
          isActive: true,
          data: settingsToStore,
        },
      });

      await tx.settings.updateMany({
        where: {
          id: { not: newSettings.id },
          isActive: true,
        },
        data: { isActive: false },
      });

      if (replaceMedia) {
        await tx.media.deleteMany({});
      }

      for (const mediaItem of preparedMedia) {
        const existing = await tx.media.findUnique({ where: { id: mediaItem.id } });
        const mediaId = existing ? `backup-media-${Date.now()}-${Math.round(Math.random() * 1e9)}` : mediaItem.id;

        await tx.media.create({
          data: {
            id: mediaId,
            filename: mediaItem.filename,
            originalName: mediaItem.originalName,
            mimeType: mediaItem.mimeType,
            size: mediaItem.buffer.length,
            type: mediaItem.type,
            uploadedBy: mediaItem.uploadedBy,
            createdAt: mediaItem.createdAt,
            updatedAt: mediaItem.updatedAt,
          },
        });
      }

      return {
        schedule: scheduleToStore,
        settings: settingsToStore,
      };
    });

    broadcastScheduleUpdate(result.schedule);
    broadcastSettingsUpdate(result.settings);

    return res.json({
      ok: true,
      importedMedia: preparedMedia.length,
      replaceMedia,
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
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
