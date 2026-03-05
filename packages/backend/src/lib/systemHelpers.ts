import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { ScheduleSchema, type DaySchedule, type PresetKey, type Schedule } from '../types/schedule.types.js';
import { UPLOAD_DIR } from './upload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../../../');

export const PRESET_KEYS: PresetKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2'];
export const DEFAULT_SAUNAS = ['Vulkan', 'Nordisch', 'Bio'];
export const MAX_UPDATE_LOG_CHARS = 200_000;
export const BACKUP_DIR = path.join(REPO_ROOT, 'backups');

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
}

export interface GitHubApiRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
}

export function createEmptyDaySchedule(saunas: string[] = DEFAULT_SAUNAS): DaySchedule {
  return {
    saunas: [...saunas],
    rows: [],
  };
}

export function createDefaultSchedule(version = 1): Schedule {
  const presets = Object.fromEntries(
    PRESET_KEYS.map((key) => [key, createEmptyDaySchedule()])
  ) as Record<PresetKey, DaySchedule>;

  return {
    version: Math.max(1, Math.floor(version)),
    presets,
    autoPlay: false,
  };
}

export function normalizeScheduleData(raw: unknown): Schedule {
  const parsed = ScheduleSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const maybeVersion = (raw as { version?: unknown } | null)?.version;
  const version = typeof maybeVersion === 'number' && Number.isFinite(maybeVersion) ? maybeVersion : 1;
  return createDefaultSchedule(version);
}

export function trimLog(value: string): string {
  if (value.length <= MAX_UPDATE_LOG_CHARS) return value;
  return value.slice(value.length - MAX_UPDATE_LOG_CHARS);
}

export async function runCommand(command: string, args: string[], cwd = REPO_ROOT): Promise<CommandResult> {
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

export function parseVersion(tag: string): number[] {
  return tag.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function readLocalVersion(): Promise<string> {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const raw = await fs.readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version || '0.0.0';
}

export async function checkDirtyTree(): Promise<boolean> {
  const dirtyResult = await runCommand('git', ['status', '--porcelain']);
  const dirtyLines = dirtyResult.stdout
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const trackedDirtyLines = dirtyLines.filter((line) => !line.startsWith('?? '));
  return dirtyResult.code === 0 && trackedDirtyLines.length > 0;
}

export async function fetchGitHubReleases(): Promise<ReleaseInfo[]> {
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

export async function createDatabaseBackup(): Promise<string | null> {
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

export async function getCurrentGitTag(): Promise<string | null> {
  const result = await runCommand('git', ['describe', '--tags', '--exact-match', 'HEAD']);
  return result.code === 0 ? result.stdout.trim() : null;
}

export function parseDateOrFallback(raw: string | undefined): Date {
  if (!raw) return new Date();
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : new Date();
}

export function sanitizeFilename(value: string): string {
  const file = path.basename(value || '').trim();
  if (!file) return 'media-file';
  return file.replace(/[^\w.\-()+]/g, '_');
}

export async function listUploadFiles(): Promise<Set<string>> {
  const names = new Set<string>();
  if (!existsSync(UPLOAD_DIR)) return names;
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isFile()) names.add(entry.name);
  });
  return names;
}

export async function clearUploadDirectory(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) return;
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => fs.unlink(path.join(UPLOAD_DIR, entry.name)))
  );
}

export function makeUniqueFilename(baseName: string, used: Set<string>): string {
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
