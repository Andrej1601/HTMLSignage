import { logAuditEvent } from '../lib/audit.js';
import type { AuthRequest } from '../lib/auth.js';
import {
  collectSystemUpdateVerification,
  runCommand,
  waitForHttpOk,
  type SystemUpdateRestartPlan,
} from '../lib/systemHelpers.js';
import {
  appendSystemJobLog,
  failSystemJob,
  getSystemJob,
  setSystemJobProgress,
  succeedSystemJob,
} from '../lib/systemJobs.js';

interface FinalizerAuditMeta {
  requestId: string | null;
  userId: string | null;
  username: string | null;
  email: string | null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} fehlt.`);
  }
  return value;
}

function parseJsonEnv<T>(name: string): T {
  return JSON.parse(getRequiredEnv(name)) as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createFinalizerAuditRequest(meta: FinalizerAuditMeta): AuthRequest {
  return {
    userId: meta.userId || undefined,
    user: meta.userId
      ? {
          id: meta.userId,
          username: meta.username || 'system-update-finalizer',
          email: meta.email || null,
          roles: [],
        }
      : undefined,
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'system-update-finalizer',
    },
    requestId: meta.requestId || null,
  } as AuthRequest;
}

async function runShellStep(jobId: string, label: string, command: string, timeoutMs = 2 * 60 * 1000): Promise<void> {
  appendSystemJobLog(jobId, `== ${label} ==`);
  appendSystemJobLog(jobId, `$ ${command}`);

  const parts = parseShellCommand(command);
  if (!parts) {
    throw new Error(`${label}: Konnte Befehl nicht parsen.`);
  }

  const result = await runCommand(parts.cmd, parts.args, { timeoutMs });
  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  if (combinedOutput) {
    appendSystemJobLog(jobId, combinedOutput);
  }
  if (result.code !== 0) {
    throw new Error(`${label} fehlgeschlagen.`);
  }
}

function parseShellCommand(command: string): { cmd: string; args: string[] } | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (ch === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    if (ch === '|' || ch === '&' || ch === ';' || ch === '>' || ch === '<' || ch === '`' || ch === '$') {
      return null;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  if (tokens.length === 0) return null;
  return { cmd: tokens[0], args: tokens.slice(1) };
}

async function failFinalizeJob(
  jobId: string,
  code: string,
  message: string,
  result: Record<string, unknown>,
  auditMeta: FinalizerAuditMeta,
): Promise<void> {
  failSystemJob(jobId, code, message, result);
  await logAuditEvent(createFinalizerAuditRequest(auditMeta), {
    action: 'system.update.failed',
    details: {
      ...result,
      jobId,
    },
  });
}

async function main(): Promise<void> {
  const jobId = getRequiredEnv('SYSTEM_UPDATE_FINALIZE_JOB_ID');
  const targetTag = getRequiredEnv('SYSTEM_UPDATE_FINALIZE_TARGET_TAG');
  const backendPid = Number.parseInt(getRequiredEnv('SYSTEM_UPDATE_FINALIZE_BACKEND_PID'), 10);
  const restartPlan = parseJsonEnv<SystemUpdateRestartPlan>('SYSTEM_UPDATE_FINALIZE_RESTART_PLAN');
  const baseResult = parseJsonEnv<Record<string, unknown>>('SYSTEM_UPDATE_FINALIZE_RESULT_BASE');
  const auditMeta = parseJsonEnv<FinalizerAuditMeta>('SYSTEM_UPDATE_FINALIZE_AUDIT');

  if (!Number.isFinite(backendPid) || backendPid <= 0) {
    throw new Error('SYSTEM_UPDATE_FINALIZE_BACKEND_PID ist ungueltig.');
  }

  const existingJob = getSystemJob(jobId);
  if (!existingJob) {
    throw new Error(`Systemjob ${jobId} wurde nicht gefunden.`);
  }

  setSystemJobProgress(jobId, 'restart', 'Dienste werden neu gestartet', 98);
  appendSystemJobLog(jobId, '== Finalisiere Update ==');
  appendSystemJobLog(jobId, `Restart-Strategie: ${restartPlan.summary}`);

  try {
    if (restartPlan.strategy === 'command') {
      if (!restartPlan.restartCommand) {
        throw new Error('SYSTEM_UPDATE_RESTART_COMMAND fehlt fuer die Restart-Strategie.');
      }
      await runShellStep(jobId, 'Restart-Dienste', restartPlan.restartCommand, 3 * 60 * 1000);
    } else if (restartPlan.strategy === 'self-process') {
      appendSystemJobLog(jobId, `Backend-Prozess ${backendPid} wird mit SIGTERM fuer den Self-Restart beendet.`);
      await sleep(1200);
      try {
        process.kill(backendPid, 'SIGTERM');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        appendSystemJobLog(jobId, `Self-Restart-Hinweis: ${message}`);
      }

      if (restartPlan.frontendRestartCommand) {
        await runShellStep(jobId, 'Frontend-Restart', restartPlan.frontendRestartCommand, 2 * 60 * 1000);
      }
    } else {
      throw new Error('Kein automatischer Restart-Pfad verfuegbar.');
    }

    setSystemJobProgress(jobId, 'healthcheck', 'Healthchecks werden geprueft', 99);

    const [backendHealth, frontendHealth] = await Promise.all([
      waitForHttpOk(restartPlan.backendHealthUrl, {
        attempts: 30,
        delayMs: 2000,
        timeoutMs: 5000,
      }),
      waitForHttpOk(restartPlan.frontendHealthUrl, {
        attempts: 20,
        delayMs: 1500,
        timeoutMs: 5000,
      }),
    ]);

    appendSystemJobLog(
      jobId,
      `[${backendHealth.ok ? 'OK' : 'ERROR'}] Backend-Healthcheck: ${backendHealth.detail}`,
    );
    appendSystemJobLog(
      jobId,
      `[${frontendHealth.ok ? 'OK' : 'ERROR'}] Frontend-Healthcheck: ${frontendHealth.detail}`,
    );

    const verification = await collectSystemUpdateVerification(targetTag, {
      restartSummary: restartPlan.summary,
      backendHealth: {
        url: restartPlan.backendHealthUrl,
        ok: backendHealth.ok,
        detail: backendHealth.detail,
      },
      frontendHealth: {
        url: restartPlan.frontendHealthUrl,
        ok: frontendHealth.ok,
        detail: frontendHealth.detail,
      },
      manualActions: backendHealth.ok && frontendHealth.ok
        ? ['Optional: Dashboard, /settings und /display kurz als Smoke-Test pruefen.']
        : [
            'Service-Logs pruefen und anschliessend die Healthchecks erneut ausfuehren.',
            'Bei Bedarf Rollback oder manuellen Dienst-Neustart durchfuehren.',
          ],
    });

    const finishedAt = new Date().toISOString();
    if (!verification.ready) {
      await failFinalizeJob(
        jobId,
        'post-restart-health-failed',
        'Neustart oder Healthcheck fehlgeschlagen.',
        {
          ...baseResult,
          verification,
          finishedAt,
          note: 'Update gebaut, aber Post-Restart-Verifikation ist fehlgeschlagen.',
          restartStrategy: restartPlan.strategy,
        },
        auditMeta,
      );
      return;
    }

    succeedSystemJob(jobId, {
      ...baseResult,
      verification,
      finishedAt,
      restartedAt: finishedAt,
      note: 'Update abgeschlossen. Dienste wurden neu gestartet und die Healthchecks sind gruen.',
      restartStrategy: restartPlan.strategy,
    });

    await logAuditEvent(createFinalizerAuditRequest(auditMeta), {
      action: 'system.update.run',
      details: {
        targetVersion: targetTag,
        newVersion: typeof baseResult.newVersion === 'string' ? baseResult.newVersion : null,
        backupPath: typeof baseResult.backupPath === 'string' ? baseResult.backupPath : null,
        requestId: auditMeta.requestId ?? null,
        jobId,
      },
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    appendSystemJobLog(jobId, `Unexpected finalize error: ${message}`);
    await failFinalizeJob(
      jobId,
      'restart-finalizer-failed',
      'Finalisierung des Systemupdates fehlgeschlagen.',
      {
        ...baseResult,
        finishedAt,
        note: message,
        restartStrategy: restartPlan.strategy,
      },
      auditMeta,
    );
  }
}

void main().catch((error) => {
  console.error('[system-update-finalize] Fatal error:', error);
  process.exitCode = 1;
});
