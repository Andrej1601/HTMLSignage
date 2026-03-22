import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import type { AuthRequest } from './auth.js';
import { logAuditEvent } from './audit.js';
import {
  REPO_ROOT,
  readLocalVersion,
  compareVersions,
  collectSystemUpdateVerification,
  createDatabaseBackup,
  resolveSystemUpdateRestartPlan,
  runCommand,
  type ReleaseInfo,
  type SystemUpdatePreflight,
} from './systemHelpers.js';
import type { PublicSystemJob, RunSystemJobContext } from './systemJobs.js';

const FINALIZER_SCRIPT_PATH = fileURLToPath(new URL('../scripts/systemUpdateFinalize.js', import.meta.url));
const BACKEND_WORKDIR = path.join(REPO_ROOT, 'packages/backend');

interface SystemUpdateStep {
  label: string;
  command: string;
  args: string[];
  timeoutMs?: number;
  percent: number;
}

export function createAuditRequestSnapshot(req: AuthRequest): AuthRequest {
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

export function normalizeSystemUpdateTag(targetVersion: string): string {
  return targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
}

export function buildSystemUpdateStatusPayload(input: {
  currentVersion: string;
  releases: ReleaseInfo[];
  preflight: SystemUpdatePreflight;
  activeJob: PublicSystemJob | null;
}) {
  const stableReleases = input.releases.filter((release) => !release.prerelease);
  const latestRelease = stableReleases.length > 0 ? stableReleases[0] : null;
  const hasUpdate = latestRelease ? compareVersions(latestRelease.tag, input.currentVersion) > 0 : false;
  const olderReleases = stableReleases.slice(1).filter(
    (release) => compareVersions(release.tag, input.currentVersion) < 0,
  );
  const workingTreeCheck = input.preflight.checks.find((check) => check.id === 'working-tree');

  return {
    ok: true as const,
    currentVersion: input.currentVersion,
    latestRelease,
    hasUpdate,
    olderReleases,
    isDirty: workingTreeCheck?.status === 'error',
    isRunning: Boolean(input.activeJob),
    activeJob: input.activeJob,
    preflight: input.preflight,
    checkedAt: new Date().toISOString(),
  };
}

function createSystemUpdateSteps(tagName: string): SystemUpdateStep[] {
  return [
    {
      label: 'Fetching tags and branches',
      command: 'git',
      args: ['fetch', '--all', '--tags', '--prune'],
      timeoutMs: 2 * 60 * 1000,
      percent: 20,
    },
    {
      label: `Checking out ${tagName}`,
      command: 'git',
      args: ['checkout', tagName],
      timeoutMs: 60 * 1000,
      percent: 30,
    },
    {
      label: 'Installing dependencies',
      command: 'pnpm',
      args: ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'],
      timeoutMs: 20 * 60 * 1000,
      percent: 45,
    },
    {
      label: 'Applying Prisma migrations',
      command: 'pnpm',
      args: ['--filter', 'backend', 'prisma', 'migrate', 'deploy'],
      timeoutMs: 10 * 60 * 1000,
      percent: 60,
    },
    {
      label: 'Building backend',
      command: 'pnpm',
      args: ['--filter', 'backend', 'build'],
      timeoutMs: 10 * 60 * 1000,
      percent: 75,
    },
    {
      label: 'Building frontend',
      command: 'pnpm',
      args: ['--filter', 'frontend', 'build'],
      timeoutMs: 15 * 60 * 1000,
      percent: 90,
    },
  ];
}

async function attemptRollback(previousTag: string, context: RunSystemJobContext): Promise<boolean> {
  context.setProgress('rollback', `Rollback auf ${previousTag}`, 95);
  context.appendLog(`\n== Rollback auf ${previousTag} ==`);

  const rollbackResult = await runCommand('git', ['checkout', previousTag], { timeoutMs: 60 * 1000 });
  if (rollbackResult.code !== 0) {
    context.appendLog('Rollback fehlgeschlagen. Manueller Eingriff erforderlich.');
    return false;
  }

  await runCommand('pnpm', ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'], { timeoutMs: 20 * 60 * 1000 });
  await runCommand('pnpm', ['--filter', 'backend', 'rebuild', 'bcrypt'], { timeoutMs: 10 * 60 * 1000 });
  await runCommand('pnpm', ['--filter', 'backend', 'build'], { timeoutMs: 10 * 60 * 1000 });
  await runCommand('pnpm', ['--filter', 'frontend', 'build'], { timeoutMs: 15 * 60 * 1000 });
  context.appendLog(`Rollback auf ${previousTag} erfolgreich.`);
  return true;
}

export async function runSystemUpdateJob(
  context: RunSystemJobContext,
  input: {
    tagName: string;
    preflight: SystemUpdatePreflight;
    auditRequest: AuthRequest;
  },
): Promise<void> {
  const { tagName, preflight, auditRequest } = input;
  let rolledBack = false;
  let backupPath: string | undefined;

  try {
    context.setProgress('preflight', 'Update-Preflight wird geprueft', 5);
    context.appendLog('== Update-Preflight ==');
    preflight.checks.forEach((check) => {
      context.appendLog(`[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`);
    });

    context.setProgress('backup', 'Datenbank-Backup wird erstellt', 10);
    context.appendLog('== Erstelle Datenbank-Backup ==');
    backupPath = await createDatabaseBackup() || undefined;
    if (!backupPath) {
      context.fail('backup-failed', 'Datenbank-Backup konnte nicht erstellt werden.', {
        targetVersion: tagName,
        preflight,
      });
      return;
    }
    context.appendLog(`DB-Backup erstellt: ${path.basename(backupPath)}`);

    const previousTagResult = await runCommand(
      'git',
      ['describe', '--tags', '--exact-match', 'HEAD'],
      { timeoutMs: 30 * 1000 },
    );
    const previousTag = previousTagResult.code === 0 ? previousTagResult.stdout.trim() : null;

    for (const step of createSystemUpdateSteps(tagName)) {
      context.setProgress('update-step', step.label, step.percent);
      context.appendLog(`== ${step.label} ==`);
      const result = await runCommand(step.command, step.args, { timeoutMs: step.timeoutMs });
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combinedOutput) {
        context.appendLog(combinedOutput);
      }

      if (result.code === 0) continue;

      if (previousTag) {
        rolledBack = await attemptRollback(previousTag, context);
      }

      context.fail('update-step-failed', `Schritt fehlgeschlagen: ${step.label}`, {
        step: step.label,
        targetVersion: tagName,
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        rolledBack,
      });

      await logAuditEvent(auditRequest, {
        action: 'system.update.failed',
        details: {
          targetVersion: tagName,
          step: step.label,
          backupPath: backupPath ? path.basename(backupPath) : null,
          rolledBack,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
      return;
    }

    context.setProgress('verify', 'Build-Artefakte werden geprueft', 96);
    const verification = await collectSystemUpdateVerification(tagName);
    verification.checks.forEach((check) => {
      context.appendLog(`[${check.status.toUpperCase()}] ${check.label}: ${check.detail}`);
    });

    if (!verification.ready) {
      context.fail('verification-failed', 'Post-Update-Verifikation fehlgeschlagen.', {
        targetVersion: tagName,
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        rolledBack,
        verification,
        preflight,
      });
      return;
    }

    const restartPlan = await resolveSystemUpdateRestartPlan(process.pid);
    if (!restartPlan.autoRestartReady) {
      context.fail('restart-plan-missing', 'Kein automatischer Restart-Pfad verfuegbar.', {
        targetVersion: tagName,
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        rolledBack,
        verification,
        preflight,
        restartPlan,
      });
      return;
    }

    context.setProgress('finalize', 'Update wird finalisiert und Dienste werden neu gestartet', 98);
    const newVersion = await readLocalVersion();
    const baseResult = {
      newVersion,
      targetVersion: tagName,
      backupPath: backupPath ? path.basename(backupPath) : undefined,
      rolledBack,
      preflight,
      buildVerification: verification,
    };

    context.appendLog(`Restart-Strategie: ${restartPlan.summary}`);
    context.appendLog('Update-Finalizer wird gestartet und fuehrt Restart plus Healthchecks aus.');

    const finalizer = spawn(process.execPath, [FINALIZER_SCRIPT_PATH], {
      cwd: BACKEND_WORKDIR,
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        SYSTEM_UPDATE_FINALIZE_JOB_ID: context.job.id,
        SYSTEM_UPDATE_FINALIZE_TARGET_TAG: tagName,
        SYSTEM_UPDATE_FINALIZE_BACKEND_PID: String(process.pid),
        SYSTEM_UPDATE_FINALIZE_RESTART_PLAN: JSON.stringify(restartPlan),
        SYSTEM_UPDATE_FINALIZE_RESULT_BASE: JSON.stringify(baseResult),
        SYSTEM_UPDATE_FINALIZE_AUDIT: JSON.stringify({
          requestId: auditRequest.requestId ?? null,
          userId: auditRequest.userId ?? null,
          username: auditRequest.user?.username ?? null,
          email: auditRequest.user?.email ?? null,
        }),
      },
    });
    finalizer.unref();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    context.appendLog(`Unexpected error: ${message}`);
    context.fail('update-failed', 'Systemupdate fehlgeschlagen', {
      targetVersion: tagName,
      backupPath: backupPath ? path.basename(backupPath) : undefined,
    });
    await logAuditEvent(auditRequest, {
      action: 'system.update.failed',
      details: {
        targetVersion: tagName,
        backupPath: backupPath ? path.basename(backupPath) : null,
        requestId: auditRequest.requestId ?? null,
        jobId: context.job.id,
      },
    });
  }
}
