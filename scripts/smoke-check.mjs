#!/usr/bin/env node

function parseArgs(argv) {
  const options = {
    frontendUrl: 'http://127.0.0.1:5173',
    backendUrl: 'http://127.0.0.1:3000',
    token: process.env.SMOKE_TOKEN || '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === '--frontend-url' && next) {
      options.frontendUrl = next;
      index += 1;
    } else if (current === '--backend-url' && next) {
      options.backendUrl = next;
      index += 1;
    } else if (current === '--token' && next) {
      options.token = next;
      index += 1;
    }
  }

  return options;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });

  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function requestStatus(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000),
  });
  return response.status;
}

async function run() {
  const { frontendUrl, backendUrl, token } = parseArgs(process.argv.slice(2));
  const checks = [];

  checks.push({
    label: 'Backend health',
    run: async () => {
      const result = await requestJson(`${backendUrl.replace(/\/$/, '')}/health`);
      if (!result.ok || result.body?.status !== 'ok') {
        throw new Error(`expected health status ok, got HTTP ${result.status}`);
      }
      return `HTTP ${result.status}`;
    },
  });

  checks.push({
    label: 'Frontend root',
    run: async () => {
      const status = await requestStatus(`${frontendUrl.replace(/\/$/, '')}/`);
      if (status !== 200) {
        throw new Error(`expected HTTP 200, got ${status}`);
      }
      return `HTTP ${status}`;
    },
  });

  checks.push({
    label: 'Display preview',
    run: async () => {
      const status = await requestStatus(`${frontendUrl.replace(/\/$/, '')}/display?preview=1`);
      if (status !== 200) {
        throw new Error(`expected HTTP 200, got ${status}`);
      }
      return `HTTP ${status}`;
    },
  });

  if (token) {
    const headers = { Authorization: `Bearer ${token}` };
    checks.push({
      label: 'Runtime status API',
      run: async () => {
        const result = await requestJson(`${backendUrl.replace(/\/$/, '')}/api/system/runtime-status`, { headers });
        if (!result.ok || result.body?.ok !== true) {
          throw new Error(`expected ok runtime payload, got HTTP ${result.status}`);
        }
        return `${result.body.devices.online} online / ${result.body.warnings.length} warnings`;
      },
    });
    checks.push({
      label: 'Runtime history API',
      run: async () => {
        const result = await requestJson(`${backendUrl.replace(/\/$/, '')}/api/system/runtime-history?hours=24`, { headers });
        if (!result.ok || result.body?.ok !== true || !Array.isArray(result.body?.points)) {
          throw new Error(`expected runtime history payload, got HTTP ${result.status}`);
        }
        return `${result.body.summary.sampleCount} samples`;
      },
    });
    checks.push({
      label: 'System jobs API',
      run: async () => {
        const result = await requestJson(`${backendUrl.replace(/\/$/, '')}/api/system/jobs?limit=1`, { headers });
        if (!result.ok || result.body?.ok !== true || !Array.isArray(result.body?.items)) {
          throw new Error(`expected system jobs payload, got HTTP ${result.status}`);
        }
        return `${result.body.items.length} job(s)`;
      },
    });
  }

  let failed = false;
  console.log(`Smoke check against frontend=${frontendUrl} backend=${backendUrl}`);
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`[OK] ${check.label}: ${detail}`);
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : 'unknown error';
      console.error(`[FAIL] ${check.label}: ${message}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('[OK] Smoke check completed');
}

void run().catch((error) => {
  console.error('[FAIL] smoke-check:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
