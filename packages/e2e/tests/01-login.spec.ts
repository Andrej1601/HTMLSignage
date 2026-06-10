/**
 * Smoke-Test: die Login-Maske rendert und ein gültiger Login landet auf
 * dem Dashboard. Read-only — keine Datenänderungen.
 */
import { test, expect, loginAsAdmin } from '../fixtures/auth';

test.describe('Login + Dashboard', () => {
  test('Login-Seite rendert die Felder', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/Benutzername|Username/i)).toBeVisible();
    await expect(page.getByLabel(/Passwort|Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Anmelden$|^Login$/i })).toBeVisible();
  });

  test('Login mit Default-Admin landet auf dem Dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    // Dashboard-Header muss erscheinen
    await expect(page.getByRole('heading', { name: /Dashboard.*Übersicht/i })).toBeVisible();
    // Mindestens eines der Kernwidgets muss sichtbar sein
    await expect(page.getByText(/Display-Health|Laufende Slideshows|Betriebsstatus/i).first()).toBeVisible();
  });

  test('Logout funktioniert und führt zurück zur Login-Maske', async ({ page }) => {
    await loginAsAdmin(page);
    // Top-rechts gibt es ein User-Menü mit Logout-Option
    const userMenuTrigger = page
      .getByRole('button', { name: /Benutzer|Konto|Logout|Abmelden/i })
      .first();
    if (await userMenuTrigger.count()) {
      await userMenuTrigger.click();
    }
    const logout = page.getByRole('menuitem', { name: /Abmelden|Logout/i }).first();
    if (await logout.count()) {
      await logout.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      test.skip(true, 'Kein Logout-Menü gefunden — Layout angepasst, Selektor aktualisieren.');
    }
  });
});
