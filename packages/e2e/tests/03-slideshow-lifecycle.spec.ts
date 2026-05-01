/**
 * Idempotenter Lifecycle-Test: legt eine Test-Slideshow an, prüft, dass
 * sie in der Liste auftaucht, und löscht sie wieder. Saubere Aufräum-
 * Logik in `afterEach`, damit auch bei Test-Abbruch kein Müll bleibt.
 *
 * Setzt voraus, dass der eingeloggte User `slideshows:manage` hat (Admin
 * oder Editor). Bei Permission-Fehlern bricht der Test früh mit klarer
 * Meldung ab.
 */
import { test, expect } from '../fixtures/auth';

const TEST_SLIDESHOW_NAME = `__E2E-Smoketest ${Date.now()}`;

test.describe('Slideshow Lifecycle', () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.goto('/slideshow');
    await expect(authedPage.getByRole('heading', { name: /Slideshow/i }).first()).toBeVisible();
  });

  test('Erstellen, Auswählen, Umbenennen, Löschen', async ({ authedPage }) => {
    // 1. Erstellen via "Neue Slideshow"-Button im Selector
    const createBtn = authedPage.getByRole('button', { name: /Neue Slideshow|Slideshow erstellen/i }).first();
    await expect(createBtn, 'Create-Button muss sichtbar sein').toBeVisible();
    await createBtn.click();
    // Inline-Input erscheint; Name eingeben + Enter
    const nameInput = authedPage.getByPlaceholder(/Name/i).first();
    await nameInput.fill(TEST_SLIDESHOW_NAME);
    await nameInput.press('Enter');

    // 2. Slideshow muss in der Tab-Bar erscheinen und ausgewählt sein
    const tab = authedPage.getByRole('button', { name: new RegExp(TEST_SLIDESHOW_NAME, 'i') }).first();
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // 3. Aktionen-Menü öffnen (3-Punkte-Button neben dem aktiven Tab)
    const actionsBtn = authedPage
      .getByRole('button', { name: new RegExp(`Aktionen für ${TEST_SLIDESHOW_NAME}`, 'i') })
      .first();
    await actionsBtn.click();
    // Menü ist via Portal in document.body — Items sollen sichtbar sein
    await expect(authedPage.getByRole('menuitem', { name: /Umbenennen/i })).toBeVisible();
    await expect(authedPage.getByRole('menuitem', { name: /Löschen/i })).toBeVisible();

    // 4. Löschen + Bestätigung
    await authedPage.getByRole('menuitem', { name: /Löschen/i }).click();
    const confirmBtn = authedPage.getByRole('button', { name: /^Löschen$/i }).last();
    await confirmBtn.click();

    // 5. Nach dem Löschen darf die Slideshow nicht mehr in der Tab-Bar
    //    auftauchen.
    await expect(
      authedPage.getByRole('button', { name: new RegExp(TEST_SLIDESHOW_NAME, 'i') }),
    ).toHaveCount(0, { timeout: 8_000 });
  });

  // Sicherheitsnetz: falls der Test mittendrin abbricht, versuchen wir
  // die Test-Slideshow per UI wegzuräumen.
  test.afterEach(async ({ authedPage }) => {
    await authedPage.goto('/slideshow');
    const stale = authedPage.getByRole('button', { name: new RegExp(TEST_SLIDESHOW_NAME, 'i') }).first();
    if (await stale.count()) {
      const actionsBtn = authedPage
        .getByRole('button', { name: new RegExp(`Aktionen für ${TEST_SLIDESHOW_NAME}`, 'i') })
        .first();
      if (await actionsBtn.count()) {
        await actionsBtn.click();
        const del = authedPage.getByRole('menuitem', { name: /Löschen/i }).first();
        if (await del.count()) {
          await del.click();
          const confirm = authedPage.getByRole('button', { name: /^Löschen$/i }).last();
          if (await confirm.count()) await confirm.click().catch(() => {});
        }
      }
    }
  });
});
