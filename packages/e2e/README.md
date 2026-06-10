# @htmlsignage/e2e — End-to-End-Tests (Playwright)

End-to-End-Tests gegen ein **bereits laufendes** HTMLSignage-Stack.

## Voraussetzungen

- Frontend läuft (z. B. `pnpm --filter frontend preview`) auf einer
  bekannten URL.
- Backend läuft und hat die DB-Migrationen angewendet.
- Mindestens ein Admin-Account (default: `admin` / `changeme` aus der
  Frischinstallation; sonst eigene Credentials via ENV setzen).

## Setup

```bash
pnpm install
pnpm --filter @htmlsignage/e2e install-browsers   # Chromium-Binary herunterladen
```

**Linux: System-Libraries.** Chromium braucht ~30 OS-Bibliotheken
(libatk, libnss3, libxkbcommon0 …). Auf dieser Maschine sind sie noch
nicht installiert — der Test bricht sonst mit
`error while loading shared libraries: libatk-1.0.so.0` ab.

Einmalig mit Root-Rechten installieren:

```bash
sudo pnpm --filter @htmlsignage/e2e install-browsers-with-deps
# oder direkt:
sudo apt install -y libatk1.0-0 libatk-bridge2.0-0 libxkbcommon0 \
                    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
                    libgbm1 libpango-1.0-0 libcairo2 libasound2t64 \
                    libnspr4 libnss3
```

Auf macOS und Windows ist nichts weiter nötig.

## Tests ausführen

```bash
# Headless gegen Default-URL (http://localhost:5173)
pnpm --filter @htmlsignage/e2e test

# Mit sichtbarem Browser
pnpm --filter @htmlsignage/e2e test:headed

# UI-Mode (interaktiv)
pnpm --filter @htmlsignage/e2e test:ui

# Anderen Account / andere URL nutzen
E2E_BASE_URL=https://staging.example.com \
E2E_USERNAME=qa@example.com \
E2E_PASSWORD=secret \
  pnpm --filter @htmlsignage/e2e test

# HTML-Report nach Lauf öffnen
pnpm --filter @htmlsignage/e2e report
```

## Was getestet wird

| Test | Mutationen | Schutz |
|------|-----------|--------|
| `01-login.spec.ts` | nein (read-only) | — |
| `02-navigation.spec.ts` | nein (read-only) | scannt `console.error`-Events |
| `03-slideshow-lifecycle.spec.ts` | ja (Create + Delete) | `afterEach`-Cleanup, ID enthält Timestamp |

## Erweitern

Neue Tests folgen dem Muster:

1. Auth-Fixture importieren (`fixtures/auth`).
2. Mutation-Tests: idempotent gestalten (eindeutige Namen mit
   `Date.now()`) und in `afterEach` aufräumen.
3. Read-only-Tests: bevorzugt nutzen, wo möglich — sicherer und
   schneller.

## Bekannte Limitationen

- Tests laufen **nicht** parallel (`fullyParallel: false`), weil viele
  Pages auf dem gemeinsamen Settings-/Schedule-Aggregat operieren.
  Parallelisierung würde Race-Conditions provozieren.
- Es gibt aktuell keinen Test gegen Display-Client-Routes (`/display`),
  weil diese via Device-Token authentifizieren — separates Setup.
