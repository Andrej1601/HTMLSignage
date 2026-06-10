import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import {
  buildSystemUpdatePreflight,
  buildSystemUpdatePreflightChecks,
  buildSystemUpdateRestartPlan,
  buildSystemUpdateVerification,
  type SystemUpdatePreflight,
  type SystemUpdateRestartPlan,
  type SystemUpdateVerification,
  type SystemUpdateVerificationOptions,
} from './systemUpdateStatus.js';
import { UPLOAD_DIR } from './upload.js';
export type {
  SystemUpdateCheck,
  SystemUpdateCheckStatus,
  SystemUpdatePreflight,
  SystemUpdateRestartPlan,
  SystemUpdateRestartStrategy,
  SystemUpdateVerification,
  SystemUpdateVerificationOptions,
} from './systemUpdateStatus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const REPO_ROOT = path.resolve(__dirname, '../../../../');

export const MAX_UPDATE_LOG_CHARS = 200_000;
export const MAX_UPDATE_LOG_LINES = 400;
export const BACKUP_DIR = path.join(REPO_ROOT, 'backups');

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
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

export function trimLog(value: string): string {
  let next = value;
  if (next.length > MAX_UPDATE_LOG_CHARS) {
    next = next.slice(next.length - MAX_UPDATE_LOG_CHARS);
  }

  const lines = next.split(/\r?\n/);
  if (lines.length > MAX_UPDATE_LOG_LINES) {
    next = lines.slice(lines.length - MAX_UPDATE_LOG_LINES).join('\n');
  }

  return next;
}

export async function runCommand(
  command: string,
  args: string[],
  cwdOrOptions: string | RunCommandOptions = REPO_ROOT,
  maybeOptions?: RunCommandOptions,
): Promise<CommandResult> {
  const baseOptions = typeof cwdOrOptions === 'string' ? maybeOptions : cwdOrOptions;
  const cwd = typeof cwdOrOptions === 'string'
    ? cwdOrOptions
    : (cwdOrOptions.cwd || REPO_ROOT);
  const timeoutMs = Math.max(5000, baseOptions?.timeoutMs ?? 10 * 60 * 1000);
  const env = {
    ...process.env,
    ...(baseOptions?.env || {}),
  };

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) return;
      stderr = trimLog(`${stderr}\nCommand timed out after ${timeoutMs}ms`);
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!finished) {
          child.kill('SIGKILL');
        }
      }, 2000).unref();
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout = trimLog(stdout + chunk.toString());
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr = trimLog(stderr + chunk.toString());
    });

    child.on('error', (error) => {
      finished = true;
      clearTimeout(timeout);
      stderr = trimLog(`${stderr}\n${String(error)}`);
      resolve({ code: 1, stdout, stderr });
    });

    child.on('close', (code) => {
      finished = true;
      clearTimeout(timeout);
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
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version || '0.0.0';
  } catch (error) {
    console.warn('[systemHelpers] readLocalVersion failed:', error);
    return '0.0.0';
  }
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

  const url = new URL(dbUrl);
  const pgEnv = {
    ...process.env,
    PGPASSWORD: url.password,
  };
  const cleanUrl = `${url.protocol}//${url.username}@${url.host}${url.pathname}${url.search}`;

  const result = await runCommand(
    'pg_dump',
    ['--clean', '--if-exists', '--format=plain', '--file', backupFile, cleanUrl],
    { cwd: REPO_ROOT, timeoutMs: 15 * 60 * 1000, env: pgEnv },
  );
  if (result.code !== 0) {
    console.error('[system] pg_dump failed:', result.stderr);
    return null;
  }
  return backupFile;
}

/**
 * Restores a plain-SQL dump created by {@link createDatabaseBackup}. The dump
 * uses `--clean --if-exists`, so replaying it with psql drops + recreates the
 * objects, returning the database to its pre-update snapshot. Used to keep the
 * DB and the (git-rolled-back) code in sync when a migration step fails.
 */
export async function restoreDatabaseBackup(backupFile: string): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[system] DB restore skipped: DATABASE_URL not set');
    return false;
  }
  if (!existsSync(backupFile)) {
    console.error('[system] DB restore skipped: backup file missing:', backupFile);
    return false;
  }

  const url = new URL(dbUrl);
  const pgEnv = { ...process.env, PGPASSWORD: url.password };
  const cleanUrl = `${url.protocol}//${url.username}@${url.host}${url.pathname}${url.search}`;

  const result = await runCommand(
    'psql',
    ['--set', 'ON_ERROR_STOP=on', '--dbname', cleanUrl, '--file', backupFile],
    { cwd: REPO_ROOT, timeoutMs: 15 * 60 * 1000, env: pgEnv },
  );
  if (result.code !== 0) {
    console.error('[system] psql restore failed:', result.stderr);
    return false;
  }
  return true;
}

/**
 * Compares the keys declared in `packages/backend/.env.example` against the
 * live `.env`. A non-empty result means the (target release's) example
 * introduced env vars the running instance does not set yet — a frequent cause
 * of post-update crash-loops on larger releases. Best-effort: returns [] when
 * either file is unreadable.
 */
export async function findMissingEnvKeys(): Promise<string[]> {
  const extractKeys = async (file: string): Promise<Set<string>> => {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      const keys = new Set<string>();
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(trimmed);
        if (match?.[1]) keys.add(match[1]);
      }
      return keys;
    } catch {
      return new Set();
    }
  };

  const exampleKeys = await extractKeys(path.join(REPO_ROOT, 'packages/backend/.env.example'));
  if (exampleKeys.size === 0) return [];
  const liveKeys = await extractKeys(path.join(REPO_ROOT, 'packages/backend/.env'));
  // If the live .env is unreadable we can't make a useful claim — stay quiet.
  if (liveKeys.size === 0) return [];
  return [...exampleKeys].filter((key) => !liveKeys.has(key));
}

export async function getCurrentGitTag(): Promise<string | null> {
  const result = await runCommand('git', ['describe', '--tags', '--exact-match', 'HEAD']);
  return result.code === 0 ? result.stdout.trim() : null;
}

export async function getCurrentGitRef(): Promise<string | null> {
  const result = await runCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  return result.code === 0 ? result.stdout.trim() : null;
}

async function hasCommand(command: string): Promise<boolean> {
  const result = await runCommand('which', [command], { timeoutMs: 15_000 });
  return result.code === 0;
}

function getEnvValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export async function getSystemdServiceFromCgroup(pid = process.pid): Promise<string | null> {
  try {
    const raw = await fs.readFile(`/proc/${pid}/cgroup`, 'utf-8');
    const match = raw.match(/\/([^/\n]+\.service)(?:\n|$)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export async function resolveSystemUpdateRestartPlan(pid = process.pid): Promise<SystemUpdateRestartPlan> {
  const backendService = getEnvValue('SYSTEM_UPDATE_BACKEND_SERVICE') || 'htmlsignage-backend.service';
  const frontendService = getEnvValue('SYSTEM_UPDATE_FRONTEND_SERVICE') || 'htmlsignage-frontend.service';
  const backendHealthUrl = getEnvValue('SYSTEM_UPDATE_BACKEND_HEALTH_URL')
    || `http://127.0.0.1:${process.env.PORT || '3000'}/health`;
  const frontendHealthUrl = getEnvValue('SYSTEM_UPDATE_FRONTEND_HEALTH_URL')
    || 'http://127.0.0.1:5173/';
  const restartCommand = getEnvValue('SYSTEM_UPDATE_RESTART_COMMAND');
  const currentService = await getSystemdServiceFromCgroup(pid);

  // The frontend runs `vite preview`, which serves the built `dist/` from
  // process start and does NOT pick up a fresh build until it is restarted.
  // When the backend runs under systemd (self-process restart) we therefore
  // default to restarting the frontend unit as well — otherwise the backend
  // updates while the UI keeps serving the old bundle (silent version skew).
  // Override via SYSTEM_UPDATE_FRONTEND_RESTART_COMMAND. NOTE: the service user
  // must be allowed to run this (polkit/sudoers) or the restart silently fails.
  const explicitFrontendRestart = getEnvValue('SYSTEM_UPDATE_FRONTEND_RESTART_COMMAND');
  const runsUnderSystemd = currentService === backendService || Boolean(restartCommand);
  const frontendRestartCommand = explicitFrontendRestart
    || (runsUnderSystemd ? `systemctl restart ${frontendService}` : null);

  return buildSystemUpdateRestartPlan({
    currentService,
    backendService,
    frontendService,
    backendHealthUrl,
    frontendHealthUrl,
    restartCommand,
    frontendRestartCommand,
  });
}

export async function waitForHttpOk(
  url: string,
  options?: { attempts?: number; delayMs?: number; timeoutMs?: number },
): Promise<{ ok: boolean; detail: string }> {
  const attempts = Math.max(1, options?.attempts ?? 15);
  const delayMs = Math.max(250, options?.delayMs ?? 2000);
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? 5000);
  let lastDetail = `Keine Antwort von ${url}.`;

  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        return {
          ok: true,
          detail: `${url} antwortet mit HTTP ${response.status}.`,
        };
      }
      lastDetail = `${url} antwortet mit HTTP ${response.status}.`;
    } catch (error) {
      lastDetail = error instanceof Error ? `${url} ist nicht erreichbar: ${error.message}` : `${url} ist nicht erreichbar.`;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return {
    ok: false,
    detail: lastDetail,
  };
}

export async function collectSystemUpdatePreflight(): Promise<SystemUpdatePreflight> {
  const [gitAvailable, pnpmAvailable, pgDumpAvailable, isDirty, currentTag, currentRef, restartPlan] = await Promise.all([
    hasCommand('git'),
    hasCommand('pnpm'),
    hasCommand('pg_dump'),
    checkDirtyTree(),
    getCurrentGitTag(),
    getCurrentGitRef(),
    resolveSystemUpdateRestartPlan(),
  ]);

  return buildSystemUpdatePreflight(buildSystemUpdatePreflightChecks({
    gitAvailable,
    pnpmAvailable,
    pgDumpAvailable,
    hasGitHubConfig: Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
    githubRepo: process.env.GITHUB_REPO ?? null,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    isDirty,
    currentTag,
    currentRef,
    restartPlan,
  }));
}

export async function collectSystemUpdateVerification(
  targetTag: string,
  options: SystemUpdateVerificationOptions = {},
): Promise<SystemUpdateVerification> {
  const [currentVersion, currentTag, currentRef] = await Promise.all([
    readLocalVersion(),
    getCurrentGitTag(),
    getCurrentGitRef(),
  ]);

  const backendDistPath = path.join(REPO_ROOT, 'packages/backend/dist/server.js');
  const frontendDistPath = path.join(REPO_ROOT, 'packages/frontend/dist/index.html');
  const backendDistReady = existsSync(backendDistPath);
  const frontendDistReady = existsSync(frontendDistPath);

  return buildSystemUpdateVerification({
    currentVersion,
    currentTag,
    currentRef,
    targetTag,
    backendDistReady,
    frontendDistReady,
    options,
    compareVersions,
  });
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

export function makeUniqueFilename(
  baseName: string,
  used: Set<string>,
  options?: { checkUploadDir?: boolean },
): string {
  const parsed = path.parse(baseName);
  const stem = parsed.name || 'media-file';
  const ext = parsed.ext || '';
  const checkUploadDir = options?.checkUploadDir !== false;

  let candidate = `${stem}${ext}`;
  let index = 1;
  while (used.has(candidate) || (checkUploadDir && existsSync(path.join(UPLOAD_DIR, candidate)))) {
    candidate = `${stem}-${index}${ext}`;
    index += 1;
  }

  used.add(candidate);
  return candidate;
}
