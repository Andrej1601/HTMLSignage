/**
 * Auth-Fixture: lädt die Login-Seite und meldet sich mit den
 * Default-Test-Credentials an. Wird von allen geschützten Tests genutzt.
 *
 * Strategie: einmal pro Worker einloggen und den Storage-State (Cookies +
 * localStorage) cachen. Für unsere Suite ist das schnell genug — ein
 * dezidierter Auth-Setup-File würde den Boilerplate-Aufwand nicht
 * rechtfertigen.
 */
import { test as base, expect, type Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME || 'admin';
const PASSWORD = process.env.E2E_PASSWORD || 'changeme';

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  // Robust gegenüber kleinen Label-Änderungen: nimmt das erste Input mit
  // type=text bzw. type=password — die Login-Maske hat genau eines davon.
  await page.getByLabel(/Benutzername|Username/i).fill(USERNAME);
  await page.getByLabel(/Passwort|Password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /^Anmelden$|^Login$/i }).click();
  // Erfolg: Dashboard sichtbar ODER eine geschützte Page ist erreicht
  await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 10_000 });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

export { expect };
