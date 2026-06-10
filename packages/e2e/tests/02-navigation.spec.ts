/**
 * Read-only-Test: nach Login kann durch alle Hauptseiten navigiert
 * werden ohne JS-Fehler in der Konsole. Keine Mutationen.
 */
import { test, expect } from '../fixtures/auth';

const ROUTES: Array<{ path: string; expectHeading: RegExp }> = [
  { path: '/dashboard', expectHeading: /Dashboard.*Übersicht/i },
  { path: '/schedule', expectHeading: /Aufgussplan/i },
  { path: '/saunas', expectHeading: /Saunas/i },
  { path: '/media', expectHeading: /Medien-Bibliothek/i },
  { path: '/slideshow', expectHeading: /Slideshow/i },
  { path: '/devices', expectHeading: /Ger(ä|a)te/i },
  { path: '/settings', expectHeading: /Einstellungen/i },
];

test.describe('Navigation durch alle Hauptseiten', () => {
  for (const { path, expectHeading } of ROUTES) {
    test(`${path} lädt fehlerfrei`, async ({ authedPage }) => {
      const consoleErrors: string[] = [];
      authedPage.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Bekannte Noise-Quellen ignorieren (DevTools, Vite HMR, …)
          if (text.match(/Download the React DevTools|\[vite\]/i)) return;
          consoleErrors.push(text);
        }
      });

      await authedPage.goto(path);
      await expect(authedPage.getByRole('heading', { name: expectHeading }).first()).toBeVisible({
        timeout: 10_000,
      });

      // Kurz warten, damit asynchrone Effekte (Daten-Fetches) ausgelöst
      // sind und potenzielle Fehler schon im Konsolenlog stehen.
      await authedPage.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
      expect(consoleErrors, `Konsolenfehler auf ${path}:\n${consoleErrors.join('\n')}`).toEqual([]);
    });
  }
});
