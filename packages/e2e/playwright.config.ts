import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright-Konfiguration für die HTMLSignage E2E-Suite.
 *
 * Pflicht-ENV:
 *   E2E_BASE_URL    — Frontend-URL, z. B. http://localhost:5173
 *
 * Optional:
 *   E2E_USERNAME, E2E_PASSWORD  — Account für Login-pflichtige Tests
 *                                  (Default: admin / changeme — nur in
 *                                  einer frischen Dev-Installation gültig)
 *   E2E_HEADED=1                — Browser sichtbar starten
 *   CI=1                        — strengere Defaults: 0 Retries lokal,
 *                                  2 Retries auf CI; mehr Worker.
 *
 * Tests laufen gegen ein **bereits laufendes Stack**. Das Hochfahren ist
 * absichtlich nicht Teil von Playwright — sonst würden die Tests die
 * Backend-DB anlegen müssen, was schiefgeht, wenn man lokal eine echte
 * DB nutzt. Die Skripte erwarten frontend (vite preview) auf E2E_BASE_URL
 * und backend automatisch via dessen API-Pfad.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // mutation tests sequenziell — vermeidet Race-Conditions auf shared state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
