import { Router } from 'express';
import { spawn } from 'child_process';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AuthRequest } from '../lib/auth.js';
import { logAuditEvent } from '../lib/audit.js';
import {
  REPO_ROOT,
  readLocalVersion,
  fetchGitHubReleases,
  compareVersions,
  collectSystemUpdatePreflight,
  collectSystemUpdateVerification,
  createDatabaseBackup,
  resolveSystemUpdateRestartPlan,
  runCommand,
} from '../lib/systemHelpers.js';
import { createSystemJob, findRunningSystemJob, runSystemJob } from '../lib/systemJobs.js';

const router = Router();
const FINALIZER_SCRIPT_PATH = fileURLToPath(new URL('../scripts/systemUpdateFinalize.js', import.meta.url));
const BACKEND_WORKDIR = path.join(REPO_ROOT, 'packages/backend');

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

// GET /update/status
router.get('/update/status', async (req: AuthRequest, res) => {
  try {
    const activeJob = findRunningSystemJob('system-update');
    const [currentVersion, releases, preflight] = await Promise.all([
      readLocalVersion(),
      fetchGitHubReleases(),
      collectSystemUpdatePreflight(),
    ]);

    const stableReleases = releases.filter((release) => !release.prerelease);
    const latestRelease = stableReleases.length > 0 ? stableReleases[0] : null;
    const hasUpdate = latestRelease ? compareVersions(latestRelease.tag, currentVersion) > 0 : false;

    const olderReleases = stableReleases.slice(1).filter(
      (release) => compareVersions(release.tag, currentVersion) < 0,
    );
    const workingTreeCheck = preflight.checks.find((check) => check.id === 'working-tree');

    res.json({
      ok: true,
      currentVersion,
      latestRelease,
      hasUpdate,
      olderReleases,
      isDirty: workingTreeCheck?.status === 'error',
      isRunning: Boolean(activeJob),
      activeJob,
      preflight,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[system] Error checking update status:', error);
    res.status(500).json({
      error: 'status-check-failed',
      message: 'Statusprüfung fehlgeschlagen',
      requestId: req.requestId ?? null,
    });
  }
});

// POST /update/run
const UpdateRunSchema = z.object({
  targetVersion: z.string().min(1),
});

router.post('/update/run', async (req: AuthRequest, res) => {
  const runningJob = findRunningSystemJob('system-update');
  if (runningJob) {
    return res.status(409).json({
      error: 'update-in-progress',
      message: 'Ein Update läuft bereits',
      job: runningJob,
      requestId: req.requestId ?? null,
    });
  }

  const parsed = UpdateRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid-request',
      details: parsed.error.errors,
      requestId: req.requestId ?? null,
    });
  }

  const { targetVersion } = parsed.data;
  const tagName = targetVersion.startsWith('v') ? targetVersion : `v${targetVersion}`;
  const auditRequest = createAuditRequestSnapshot(req);
  const preflight = await collectSystemUpdatePreflight();

  if (!preflight.ready) {
    await logAuditEvent(auditRequest, {
      action: 'system.update.blocked',
      details: {
        targetVersion: tagName,
        blockers: preflight.blockers,
        requestId: auditRequest.requestId ?? null,
      },
    });

    return res.status(409).json({
      error: 'update-preflight-failed',
      message: 'Update-Preflight fehlgeschlagen.',
      preflight,
      requestId: req.requestId ?? null,
    });
  }

  const job = createSystemJob({
    type: 'system-update',
    title: `Update auf ${tagName}`,
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
      if (backupPath) {
        context.appendLog(`DB-Backup erstellt: ${path.basename(backupPath)}`);
      } else {
        context.fail('backup-failed', 'Datenbank-Backup konnte nicht erstellt werden.', {
          targetVersion: tagName,
          preflight,
        });
        return;
      }

      const previousTagResult = await runCommand('git', ['describe', '--tags', '--exact-match', 'HEAD'], { timeoutMs: 30 * 1000 });
      const previousTag = previousTagResult.code === 0 ? previousTagResult.stdout.trim() : null;

      const steps: Array<{ label: string; command: string; args: string[]; timeoutMs?: number; percent: number }> = [
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

      for (const step of steps) {
        context.setProgress('update-step', step.label, step.percent);
        context.appendLog(`== ${step.label} ==`);
        const result = await runCommand(step.command, step.args, { timeoutMs: step.timeoutMs });
        const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
        if (combinedOutput) {
          context.appendLog(combinedOutput);
        }

        if (result.code !== 0) {
          if (previousTag) {
            context.setProgress('rollback', `Rollback auf ${previousTag}`, 95);
            context.appendLog(`\n== Rollback auf ${previousTag} ==`);
            const rollbackResult = await runCommand('git', ['checkout', previousTag], { timeoutMs: 60 * 1000 });
            if (rollbackResult.code === 0) {
              await runCommand('pnpm', ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'], { timeoutMs: 20 * 60 * 1000 });
              await runCommand('pnpm', ['--filter', 'backend', 'build'], { timeoutMs: 10 * 60 * 1000 });
              await runCommand('pnpm', ['--filter', 'frontend', 'build'], { timeoutMs: 15 * 60 * 1000 });
              context.appendLog(`Rollback auf ${previousTag} erfolgreich.`);
              rolledBack = true;
            } else {
              context.appendLog('Rollback fehlgeschlagen. Manueller Eingriff erforderlich.');
            }
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

      const finalizer = spawn(
        process.execPath,
        [FINALIZER_SCRIPT_PATH],
        {
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
        },
      );
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
  });

  return res.status(202).json({
    ok: true,
    jobId: job.id,
    job,
    message: `Update auf ${tagName} wurde gestartet.`,
  });
});

export default router;
