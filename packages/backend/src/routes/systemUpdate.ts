import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import type { AuthRequest } from '../lib/auth.js';
import { logAuditEvent } from '../lib/audit.js';
import {
  readLocalVersion,
  fetchGitHubReleases,
  checkDirtyTree,
  compareVersions,
  getCurrentGitTag,
  createDatabaseBackup,
  runCommand,
} from '../lib/systemHelpers.js';
import { createSystemJob, findRunningSystemJob, runSystemJob } from '../lib/systemJobs.js';

const router = Router();

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
    const [currentVersion, releases, isDirty] = await Promise.all([
      readLocalVersion(),
      fetchGitHubReleases(),
      checkDirtyTree(),
    ]);

    const stableReleases = releases.filter((release) => !release.prerelease);
    const latestRelease = stableReleases.length > 0 ? stableReleases[0] : null;
    const hasUpdate = latestRelease ? compareVersions(latestRelease.tag, currentVersion) > 0 : false;

    const olderReleases = stableReleases.slice(1).filter(
      (release) => compareVersions(release.tag, currentVersion) < 0,
    );

    res.json({
      ok: true,
      currentVersion,
      latestRelease,
      hasUpdate,
      olderReleases,
      isDirty,
      isRunning: Boolean(activeJob),
      activeJob,
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
      context.setProgress('preflight', 'Arbeitsbaum wird geprüft', 5);
      const isDirty = await checkDirtyTree();
      if (isDirty) {
        context.appendLog('Working tree has local changes. Aborting update to avoid conflicts.');
        context.fail('working-tree-dirty', 'Lokale Änderungen blockieren das Update.');
        return;
      }

      const previousTag = await getCurrentGitTag();

      context.setProgress('backup', 'Datenbank-Backup wird erstellt', 10);
      context.appendLog('== Erstelle Datenbank-Backup ==');
      backupPath = await createDatabaseBackup() || undefined;
      if (backupPath) {
        context.appendLog(`DB-Backup erstellt: ${path.basename(backupPath)}`);
      } else {
        context.appendLog('Warnung: DB-Backup konnte nicht erstellt werden. Update wird fortgesetzt.');
      }

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

      context.setProgress('finalize', 'Version wird geprüft', 98);
      const newVersion = await readLocalVersion();
      const successResult = {
        newVersion,
        targetVersion: tagName,
        finishedAt: new Date().toISOString(),
        note: 'Update abgeschlossen. Bitte Backend-/Frontend-Dienste neu starten.',
        backupPath: backupPath ? path.basename(backupPath) : undefined,
        rolledBack,
      };

      context.succeed(successResult);
      await logAuditEvent(auditRequest, {
        action: 'system.update.run',
        details: {
          targetVersion: tagName,
          newVersion,
          backupPath: backupPath ? path.basename(backupPath) : null,
          requestId: auditRequest.requestId ?? null,
          jobId: context.job.id,
        },
      });
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
