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
  restoreDatabaseBackup,
  findMissingEnvKeys,
  resolveSystemUpdateRestartPlan,
  runCommand,
  type ReleaseInfo,
  type SystemUpdatePreflight,
} from './systemHelpers.js';
import type { PublicSystemJob, RunSystemJobContext } from './systemJobs.js';

const FINALIZER_SCRIPT_PATH = fileURLToPath(new URL('../scripts/systemUpdateFinalize.js', import.meta.url));
const BACKEND_WORKDIR = path.join(REPO_ROOT, 'packages/backend');

interface SystemUpdateStep {
  id: string;
  label: string;
  command: string;
  args: string[];
  timeoutMs?: number;
  percent: number;
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
      id: 'fetch',
      label: 'Fetching tags and branches',
      command: 'git',
      args: ['fetch', '--all', '--tags', '--prune'],
      timeoutMs: 2 * 60 * 1000,
      percent: 18,
    },
    {
      id: 'checkout',
      label: `Checking out ${tagName}`,
      command: 'git',
      args: ['checkout', tagName],
      timeoutMs: 60 * 1000,
      percent: 28,
    },
    {
      id: 'install',
      label: 'Installing dependencies',
      command: 'pnpm',
      args: ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'],
      timeoutMs: 20 * 60 * 1000,
      percent: 42,
    },
    {
      // Deterministic Prisma client generation — don't rely on the install
      // postinstall (which is skipped under --ignore-scripts).
      id: 'generate',
      label: 'Generating Prisma client',
      command: 'pnpm',
      args: ['--filter', 'backend', 'prisma', 'generate'],
      timeoutMs: 5 * 60 * 1000,
      percent: 52,
    },
    {
      id: 'migrate',
      label: 'Applying Prisma migrations',
      command: 'pnpm',
      args: ['--filter', 'backend', 'prisma', 'migrate', 'deploy'],
      timeoutMs: 10 * 60 * 1000,
      percent: 62,
    },
    {
      id: 'build-backend',
      label: 'Building backend',
      command: 'pnpm',
      args: ['--filter', 'backend', 'build'],
      timeoutMs: 10 * 60 * 1000,
      percent: 76,
    },
    {
      id: 'build-frontend',
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

    // Rollback target: prefer the exact tag HEAD is on; fall back to the raw
    // commit SHA so a failed update can still be reverted even when HEAD isn't
    // on a tag (e.g. running off a branch like DEV).
    const previousTagResult = await runCommand(
      'git',
      ['describe', '--tags', '--exact-match', 'HEAD'],
      { timeoutMs: 30 * 1000 },
    );
    let rollbackRef = previousTagResult.code === 0 ? previousTagResult.stdout.trim() : null;
    if (!rollbackRef) {
      const shaResult = await runCommand('git', ['rev-parse', 'HEAD'], { timeoutMs: 30 * 1000 });
      rollbackRef = shaResult.code === 0 ? shaResult.stdout.trim() : null;
    }
    context.appendLog(rollbackRef
      ? `Rollback-Referenz: ${rollbackRef}`
      : 'Warnung: keine Rollback-Referenz ermittelbar — Fehler erfordert manuellen Eingriff.');

    let migrationsTouched = false;

    for (const step of createSystemUpdateSteps(tagName)) {
      context.setProgress('update-step', step.label, step.percent);
      context.appendLog(`== ${step.label} ==`);
      const result = await runCommand(step.command, step.args, { timeoutMs: step.timeoutMs });
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combinedOutput) {
        context.appendLog(combinedOutput);
      }

      // Mark once the migration step has been attempted (success or failure) —
      // from here on the schema may have changed, so a code rollback must be
      // paired with a DB restore.
      if (step.id === 'migrate') migrationsTouched = true;

      if (result.code === 0) continue;

      // 1) Revert the code.
      if (rollbackRef) {
        rolledBack = await attemptRollback(rollbackRef, context);
      }

      // 2) If migrations were already applied/attempted, restore the DB to the
      //    pre-update snapshot so it matches the rolled-back code (Prisma
      //    migrations are forward-only — the git checkout can't undo them).
      let dbRestored = false;
      if (rolledBack && migrationsTouched && backupPath) {
        context.setProgress('rollback', 'Datenbank wird aus Backup wiederhergestellt', 95);
        context.appendLog('== Migrationen berührt — DB-Backup wird zurückgespielt ==');
        dbRestored = await restoreDatabaseBackup(backupPath);
        context.appendLog(dbRestored
          ? 'DB-Backup erfolgreich zurückgespielt.'
          : `DB-Restore fehlgeschlagen — manueller Eingriff erforderlich (Backup: ${path.basename(backupPath)}).`);
      }

      context.fail('update-step-failed', `Schritt fehlgeschlagen: ${step.label}`, {
        step: step.label,
        targetVersion: tagName,
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        rolledBack,
        dbRestored,
      });

      await logAuditEvent(auditRequest, {
        action: 'system.update.failed',
        details: {
          targetVersion: tagName,
          step: step.label,
          backupPath: backupPath ? path.basename(backupPath) : null,
          rolledBack,
          dbRestored,
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

    // Surface env vars the new release's .env.example introduced but the live
    // .env doesn't set yet — a frequent cause of post-restart crash-loops.
    const missingEnvKeys = await findMissingEnvKeys();
    if (missingEnvKeys.length > 0) {
      context.appendLog(
        `Warnung: Neue Variablen in .env.example fehlen in packages/backend/.env: ${missingEnvKeys.join(', ')}. `
        + 'Bitte vor dem Neustart ergänzen, sonst kann das Backend nach dem Restart fehlschlagen.',
      );
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
      missingEnvKeys,
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
