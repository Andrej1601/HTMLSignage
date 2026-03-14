import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import type { AuthRequest } from '../lib/auth.js';
import {
  readLocalVersion,
  fetchGitHubReleases,
  checkDirtyTree,
  compareVersions,
  getCurrentGitTag,
  createDatabaseBackup,
  runCommand,
  trimLog,
} from '../lib/systemHelpers.js';

const router = Router();

let isUpdateRunning = false;

// GET /update/status
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
    res.status(500).json({ error: 'status-check-failed', message: 'Statusprüfung fehlgeschlagen' });
  }
});

// POST /update/run
const UpdateRunSchema = z.object({
  targetVersion: z.string().min(1),
});

router.post('/update/run', async (req: AuthRequest, res) => {
  if (isUpdateRunning) {
    return res.status(409).json({ error: 'update-in-progress', message: 'Ein Update läuft bereits' });
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

    const previousTag = await getCurrentGitTag();

    appendLog('== Erstelle Datenbank-Backup ==');
    const backupPath = await createDatabaseBackup();
    if (backupPath) {
      appendLog(`DB-Backup erstellt: ${path.basename(backupPath)}`);
    } else {
      appendLog('Warnung: DB-Backup konnte nicht erstellt werden. Update wird fortgesetzt.');
    }

    const steps: Array<{ label: string; command: string; args: string[]; timeoutMs?: number }> = [
      {
        label: 'Fetching tags and branches',
        command: 'git',
        args: ['fetch', '--all', '--tags', '--prune'],
        timeoutMs: 2 * 60 * 1000,
      },
      {
        label: `Checking out ${tagName}`,
        command: 'git',
        args: ['checkout', tagName],
        timeoutMs: 60 * 1000,
      },
      {
        label: 'Installing dependencies',
        command: 'pnpm',
        args: ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'],
        timeoutMs: 20 * 60 * 1000,
      },
      {
        label: 'Applying Prisma migrations',
        command: 'pnpm',
        args: ['--filter', 'backend', 'prisma', 'migrate', 'deploy'],
        timeoutMs: 10 * 60 * 1000,
      },
      {
        label: 'Building backend',
        command: 'pnpm',
        args: ['--filter', 'backend', 'build'],
        timeoutMs: 10 * 60 * 1000,
      },
      {
        label: 'Building frontend',
        command: 'pnpm',
        args: ['--filter', 'frontend', 'build'],
        timeoutMs: 15 * 60 * 1000,
      },
    ];

    let rolledBack = false;

    for (const step of steps) {
      appendLog(`== ${step.label} ==`);
      const result = await runCommand(step.command, step.args, { timeoutMs: step.timeoutMs });
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
      if (combinedOutput) {
        appendLog(combinedOutput);
      }

      if (result.code !== 0) {
        if (previousTag) {
          appendLog(`\n== Rollback auf ${previousTag} ==`);
          const rollbackResult = await runCommand('git', ['checkout', previousTag], { timeoutMs: 60 * 1000 });
          if (rollbackResult.code === 0) {
            await runCommand('pnpm', ['install', '--force', '--no-frozen-lockfile', '--ignore-scripts=false'], { timeoutMs: 20 * 60 * 1000 });
            await runCommand('pnpm', ['--filter', 'backend', 'build'], { timeoutMs: 10 * 60 * 1000 });
            await runCommand('pnpm', ['--filter', 'frontend', 'build'], { timeoutMs: 15 * 60 * 1000 });
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

export default router;
