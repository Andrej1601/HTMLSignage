import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSystemUpdatePreflight,
  buildSystemUpdatePreflightChecks,
  buildSystemUpdateRestartPlan,
  buildSystemUpdateVerification,
} from './systemUpdateStatus.js';

test('buildSystemUpdateRestartPlan chooses command, self-process and manual strategies', () => {
  const commandPlan = buildSystemUpdateRestartPlan({
    currentService: 'htmlsignage-backend.service',
    backendService: 'htmlsignage-backend.service',
    frontendService: 'htmlsignage-frontend.service',
    backendHealthUrl: 'http://127.0.0.1:3000/health',
    frontendHealthUrl: 'http://127.0.0.1:5173/',
    restartCommand: 'sudo systemctl restart htmlsignage-backend.service',
    frontendRestartCommand: null,
  });
  assert.equal(commandPlan.strategy, 'command');
  assert.equal(commandPlan.autoRestartReady, true);

  const selfProcessPlan = buildSystemUpdateRestartPlan({
    currentService: 'htmlsignage-backend.service',
    backendService: 'htmlsignage-backend.service',
    frontendService: 'htmlsignage-frontend.service',
    backendHealthUrl: 'http://127.0.0.1:3000/health',
    frontendHealthUrl: 'http://127.0.0.1:5173/',
    restartCommand: null,
    frontendRestartCommand: null,
  });
  assert.equal(selfProcessPlan.strategy, 'self-process');

  const manualPlan = buildSystemUpdateRestartPlan({
    currentService: null,
    backendService: 'htmlsignage-backend.service',
    frontendService: 'htmlsignage-frontend.service',
    backendHealthUrl: 'http://127.0.0.1:3000/health',
    frontendHealthUrl: 'http://127.0.0.1:5173/',
    restartCommand: null,
    frontendRestartCommand: null,
  });
  assert.equal(manualPlan.strategy, 'manual');
  assert.equal(manualPlan.autoRestartReady, false);
});

test('buildSystemUpdatePreflightChecks and buildSystemUpdatePreflight summarize blockers and warnings', () => {
  const restartPlan = buildSystemUpdateRestartPlan({
    currentService: 'custom.service',
    backendService: 'htmlsignage-backend.service',
    frontendService: 'htmlsignage-frontend.service',
    backendHealthUrl: 'http://127.0.0.1:3000/health',
    frontendHealthUrl: 'http://127.0.0.1:5173/',
    restartCommand: null,
    frontendRestartCommand: null,
  });

  const checks = buildSystemUpdatePreflightChecks({
    gitAvailable: true,
    pnpmAvailable: true,
    pgDumpAvailable: false,
    hasGitHubConfig: true,
    githubRepo: 'org/repo',
    hasDatabaseUrl: true,
    isDirty: true,
    currentTag: null,
    currentRef: 'DEV',
    restartPlan,
  });

  const preflight = buildSystemUpdatePreflight(checks);
  assert.equal(preflight.ready, false);
  assert.ok(preflight.blockers.some((detail) => detail.includes('pg_dump fehlt')));
  assert.ok(preflight.blockers.some((detail) => detail.includes('Lokale, tracked Aenderungen')));
  assert.ok(preflight.warnings.some((detail) => detail.includes('HEAD ist nicht auf einem exakten Tag')));
});

test('buildSystemUpdateVerification builds checks and fallback manual actions consistently', () => {
  const verification = buildSystemUpdateVerification({
    currentVersion: '2.0.0',
    currentTag: 'v2.0.0',
    currentRef: 'HEAD',
    targetTag: 'v2.0.1',
    backendDistReady: true,
    frontendDistReady: false,
    compareVersions: () => -1,
  });

  assert.equal(verification.ready, false);
  assert.ok(verification.checks.some((check) => check.id === 'frontend-dist' && check.status === 'error'));
  assert.ok(verification.manualActions.some((action) => action.includes('Backend-Dienst neu starten')));

  const verifiedAfterRestart = buildSystemUpdateVerification({
    currentVersion: '2.0.1',
    currentTag: 'v2.0.1',
    currentRef: 'HEAD',
    targetTag: 'v2.0.1',
    backendDistReady: true,
    frontendDistReady: true,
    options: {
      restartSummary: 'Restart erfolgreich abgeschlossen.',
      backendHealth: {
        url: 'http://127.0.0.1:3000/health',
        ok: true,
        detail: 'Backend healthy.',
      },
      frontendHealth: {
        url: 'http://127.0.0.1:5173/',
        ok: true,
        detail: 'Frontend healthy.',
      },
    },
    compareVersions: () => 0,
  });

  assert.equal(verifiedAfterRestart.ready, true);
  assert.ok(verifiedAfterRestart.manualActions.some((action) => action.includes('Dashboard')));
});
