export type SystemUpdateCheckStatus = 'ok' | 'warning' | 'error';

export interface SystemUpdateCheck {
  id: string;
  label: string;
  status: SystemUpdateCheckStatus;
  detail: string;
}

export interface SystemUpdatePreflight {
  ready: boolean;
  checks: SystemUpdateCheck[];
  blockers: string[];
  warnings: string[];
}

export interface SystemUpdateVerification {
  ready: boolean;
  checks: SystemUpdateCheck[];
  manualActions: string[];
}

export type SystemUpdateRestartStrategy = 'command' | 'self-process' | 'manual';

export interface SystemUpdateRestartPlan {
  strategy: SystemUpdateRestartStrategy;
  autoRestartReady: boolean;
  currentService: string | null;
  backendService: string;
  frontendService: string;
  backendHealthUrl: string;
  frontendHealthUrl: string;
  restartCommand: string | null;
  frontendRestartCommand: string | null;
  summary: string;
}

export interface SystemUpdateVerificationOptions {
  restartSummary?: string | null;
  backendHealth?: { url: string; ok: boolean; detail: string } | null;
  frontendHealth?: { url: string; ok: boolean; detail: string } | null;
  manualActions?: string[];
}

export function buildSystemUpdateRestartPlan(input: {
  currentService: string | null;
  backendService: string;
  frontendService: string;
  backendHealthUrl: string;
  frontendHealthUrl: string;
  restartCommand: string | null;
  frontendRestartCommand: string | null;
}): SystemUpdateRestartPlan {
  if (input.restartCommand) {
    return {
      strategy: 'command',
      autoRestartReady: true,
      currentService: input.currentService,
      backendService: input.backendService,
      frontendService: input.frontendService,
      backendHealthUrl: input.backendHealthUrl,
      frontendHealthUrl: input.frontendHealthUrl,
      restartCommand: input.restartCommand,
      frontendRestartCommand: input.frontendRestartCommand,
      summary: 'Restart ueber SYSTEM_UPDATE_RESTART_COMMAND konfiguriert.',
    };
  }

  if (input.currentService === input.backendService) {
    return {
      strategy: 'self-process',
      autoRestartReady: true,
      currentService: input.currentService,
      backendService: input.backendService,
      frontendService: input.frontendService,
      backendHealthUrl: input.backendHealthUrl,
      frontendHealthUrl: input.frontendHealthUrl,
      restartCommand: null,
      frontendRestartCommand: input.frontendRestartCommand,
      summary: `Backend laeuft unter ${input.backendService} und kann per Self-Restart finalisiert werden.`,
    };
  }

  return {
    strategy: 'manual',
    autoRestartReady: false,
    currentService: input.currentService,
    backendService: input.backendService,
    frontendService: input.frontendService,
    backendHealthUrl: input.backendHealthUrl,
    frontendHealthUrl: input.frontendHealthUrl,
    restartCommand: null,
    frontendRestartCommand: input.frontendRestartCommand,
    summary: input.currentService
      ? `Aktueller Dienst ist ${input.currentService}; erwartet wird ${input.backendService} oder SYSTEM_UPDATE_RESTART_COMMAND.`
      : 'Kein automatischer Restart-Pfad erkannt. SYSTEM_UPDATE_RESTART_COMMAND fehlt und der Backend-Prozess laeuft nicht unter der erwarteten systemd-Unit.',
  };
}

export function buildSystemUpdatePreflight(checks: SystemUpdateCheck[]): SystemUpdatePreflight {
  return {
    ready: checks.every((check) => check.status !== 'error'),
    checks,
    blockers: checks.filter((check) => check.status === 'error').map((check) => check.detail),
    warnings: checks.filter((check) => check.status === 'warning').map((check) => check.detail),
  };
}

export function buildSystemUpdatePreflightChecks(input: {
  gitAvailable: boolean;
  pnpmAvailable: boolean;
  pgDumpAvailable: boolean;
  hasGitHubConfig: boolean;
  githubRepo: string | null;
  hasDatabaseUrl: boolean;
  isDirty: boolean;
  currentTag: string | null;
  currentRef: string | null;
  restartPlan: SystemUpdateRestartPlan;
}): SystemUpdateCheck[] {
  return [
    {
      id: 'git',
      label: 'Git CLI',
      status: input.gitAvailable ? 'ok' : 'error',
      detail: input.gitAvailable ? 'Git ist verfuegbar.' : 'Git ist auf dem Host nicht verfuegbar.',
    },
    {
      id: 'pnpm',
      label: 'pnpm',
      status: input.pnpmAvailable ? 'ok' : 'error',
      detail: input.pnpmAvailable ? 'pnpm ist verfuegbar.' : 'pnpm ist auf dem Host nicht verfuegbar.',
    },
    {
      id: 'github-config',
      label: 'GitHub-Zugang',
      status: input.hasGitHubConfig ? 'ok' : 'error',
      detail: input.hasGitHubConfig
        ? `Release-Quelle: ${input.githubRepo}`
        : 'GITHUB_TOKEN oder GITHUB_REPO fehlt.',
    },
    {
      id: 'database-url',
      label: 'Datenbank-URL',
      status: input.hasDatabaseUrl ? 'ok' : 'error',
      detail: input.hasDatabaseUrl
        ? 'DATABASE_URL ist gesetzt.'
        : 'DATABASE_URL fehlt. Backup und Migrationen koennen nicht sicher ausgefuehrt werden.',
    },
    {
      id: 'pg-dump',
      label: 'Backup-Werkzeug',
      status: input.pgDumpAvailable ? 'ok' : 'error',
      detail: input.pgDumpAvailable
        ? 'pg_dump ist verfuegbar.'
        : 'pg_dump fehlt. Datenbank-Backups koennen nicht erstellt werden.',
    },
    {
      id: 'working-tree',
      label: 'Arbeitsbaum',
      status: input.isDirty ? 'error' : 'ok',
      detail: input.isDirty
        ? 'Lokale, tracked Aenderungen blockieren das Update.'
        : 'Arbeitsbaum ist sauber.',
    },
    {
      id: 'git-ref',
      label: 'Aktueller Git-Ref',
      status: input.currentTag ? 'ok' : 'warning',
      detail: input.currentTag
        ? `Aktueller Stand: ${input.currentTag}`
        : `HEAD ist nicht auf einem exakten Tag (${input.currentRef || 'unbekannt'}).`,
    },
    {
      id: 'restart-strategy',
      label: 'Runner-Finalisierung',
      status: input.restartPlan.autoRestartReady ? 'ok' : 'error',
      detail: input.restartPlan.summary,
    },
    {
      id: 'backend-health',
      label: 'Backend-Healthcheck',
      status: 'ok',
      detail: `Backend wird nach dem Update ueber ${input.restartPlan.backendHealthUrl} geprueft.`,
    },
    {
      id: 'frontend-health',
      label: 'Frontend-Healthcheck',
      status: 'ok',
      detail: `Frontend wird nach dem Update ueber ${input.restartPlan.frontendHealthUrl} geprueft.`,
    },
  ];
}

export function buildSystemUpdateVerification(input: {
  currentVersion: string;
  currentTag: string | null;
  currentRef: string | null;
  targetTag: string;
  backendDistReady: boolean;
  frontendDistReady: boolean;
  options?: SystemUpdateVerificationOptions;
  compareVersions: (a: string, b: string) => number;
}): SystemUpdateVerification {
  const options = input.options ?? {};
  const checks: SystemUpdateCheck[] = [
    {
      id: 'git-tag',
      label: 'Git-Checkout',
      status: input.currentTag === input.targetTag ? 'ok' : 'warning',
      detail: input.currentTag === input.targetTag
        ? `HEAD steht auf ${input.targetTag}.`
        : `Aktueller Ref: ${input.currentTag || input.currentRef || 'unbekannt'}.`,
    },
    {
      id: 'backend-dist',
      label: 'Backend-Build',
      status: input.backendDistReady ? 'ok' : 'error',
      detail: input.backendDistReady
        ? 'packages/backend/dist/server.js ist vorhanden.'
        : 'Backend-Buildartefakt fehlt.',
    },
    {
      id: 'frontend-dist',
      label: 'Frontend-Build',
      status: input.frontendDistReady ? 'ok' : 'error',
      detail: input.frontendDistReady
        ? 'packages/frontend/dist/index.html ist vorhanden.'
        : 'Frontend-Buildartefakt fehlt.',
    },
    {
      id: 'package-version',
      label: 'Paketversion',
      status: input.compareVersions(input.currentVersion, input.targetTag) === 0 ? 'ok' : 'warning',
      detail: input.compareVersions(input.currentVersion, input.targetTag) === 0
        ? `package.json meldet ${input.currentVersion}.`
        : `package.json meldet ${input.currentVersion}, Ziel-Tag ist ${input.targetTag}.`,
    },
  ];

  if (options.restartSummary) {
    checks.push({
      id: 'runner-finalization',
      label: 'Runner-Finalisierung',
      status: 'ok',
      detail: options.restartSummary,
    });
  } else {
    checks.push({
      id: 'restart-required',
      label: 'Dienst-Neustart',
      status: 'warning',
      detail: 'Backend- und Frontend-Dienste muessen nach dem Update kontrolliert neu gestartet werden.',
    });
  }

  if (options.backendHealth) {
    checks.push({
      id: 'backend-health',
      label: 'Backend-Healthcheck',
      status: options.backendHealth.ok ? 'ok' : 'error',
      detail: options.backendHealth.detail,
    });
  }

  if (options.frontendHealth) {
    checks.push({
      id: 'frontend-health',
      label: 'Frontend-Healthcheck',
      status: options.frontendHealth.ok ? 'ok' : 'error',
      detail: options.frontendHealth.detail,
    });
  }

  const manualActions = options.manualActions ?? (
    options.backendHealth || options.frontendHealth
      ? ['Optional: Dashboard, /settings und /display kurz als Smoke-Test pruefen.']
      : [
          'Backend-Dienst neu starten und /health pruefen.',
          'Frontend-Preview bzw. Webserver neu laden.',
          'Anschliessend Dashboard, /settings und /display kurz als Smoke-Test pruefen.',
        ]
  );

  return {
    ready: checks.every((check) => check.status !== 'error'),
    checks,
    manualActions,
  };
}
