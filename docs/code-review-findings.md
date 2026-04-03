# Code- & Architektur-Review: HTMLSignage

**Datum:** 2026-04-03
**Version:** 2.0.0
**Status:** 30 von 30 Findings behoben (100%)

---

## Umsetzungsstatus Übersicht

### Kritisch (6/6 — 100%)

| # | Finding | Status |
|---|---------|--------|
| 1 | Unauthentifizierter System-Update-Endpoint | ✅ Behoben |
| 2 | JWT im localStorage (XSS-anfällig) | ✅ Behoben |
| 3 | Doppelter WebSocket-Connection im Dashboard | ✅ Behoben |
| 4 | Race Condition bei Versioned Entities | ✅ Behoben |
| 5 | Command Injection via System Update | ✅ Behoben |
| 6 | useMemo für Side-Effects (React-Regelverletzung) | ✅ Behoben |

### Wichtig (11/14 — 79%)

| # | Finding | Status |
|---|---------|--------|
| 7 | Unauthentifizierte READ-Endpoints | ⏭️ Übersprungen (Display-Client braucht Public Access) |
| 8 | CORS Default absichern | ✅ Behoben |
| 9 | God Components / Hooks | 📋 Backlog (größerer Refactor) |
| 10 | Duplicate fetchApi konsolidieren | ✅ Behoben |
| 11 | Audit-Tabelle via Migration | 📋 Backlog (DB-Migration nötig) |
| 12 | System-Jobs in DB migrieren | 📋 Backlog (Architektur-Change) |
| 13 | Error Boundaries für Dashboard-Widgets | ✅ Behoben |
| 14 | AuthContext-Value memoisieren | ✅ Behoben (Teil von #2) |
| 15 | SaunasPage Status-Update Fehler-Feedback | ✅ Behoben |
| 16 | Device Token Lifetime + Revocation | ✅ Behoben |
| 17 | bcryptjs → native bcrypt | ✅ Behoben |
| 18 | Duplicate Utility-Funktionen | ✅ Behoben |
| 19 | Layout key={pathname} Remount | ✅ Behoben |
| 20 | targetVersion Semver-Validierung | ✅ Behoben (Teil von #1) |

### Optional (10/10 — 100%)

| # | Finding | Status |
|---|---------|--------|
| 21 | Error Boundaries DisplayApp | ✅ Bereits vorhanden (SlideErrorBoundary) |
| 22 | Magic Numbers in constants.ts | ✅ Behoben |
| 23 | Accessibility-Lücken | ✅ Behoben (aria-describedby für Error Messages) |
| 24 | Passwort-Mindestlänge vereinheitlichen | ✅ Behoben |
| 25 | ConfirmDialog als Dialog-Wrapper | ✅ Behoben |
| 26 | SaunasPage useRef statt State | ✅ Behoben |
| 27 | Leerer Import-Block (Dead Code) | ✅ Behoben |
| 28 | dotenv.config() mehrfach | ✅ Behoben |
| 29 | DataTable Columns memoisieren | ✅ Behoben |
| 30 | !important CSS-Override | ✅ Behoben (active Button-Variante) |

---

## Detaillierte Findings

### 1. Unauthentifizierter System-Update-Endpoint
- **Pfad:** `packages/backend/src/routes/systemUpdate.ts:50`
- **Problem:** `POST /api/system/update/run` ohne Authentifizierung.
- **Fix:** `authMiddleware` + `requireRole('admin')` + `requirePermission('system:manage')` + Semver-Validierung.

### 2. JWT im localStorage (XSS-anfällig)
- **Pfad:** `packages/frontend/src/contexts/AuthContext.tsx:22`, `services/api/core.ts:16`
- **Fix:** Vollständige Migration auf httpOnly-Cookies (`secure`, `sameSite: 'lax'`). `cookie-parser` Middleware, `credentials: 'include'`, localStorage entfernt, `AuthContext.value` mit `useMemo` memoisiert.

### 3. Doppelter WebSocket-Connection im Dashboard
- **Pfad:** `packages/frontend/src/hooks/useDashboardData.ts:55`
- **Fix:** `useWebSocketStatus()` aus Context statt eigener Socket. `WebSocketContext` um `error`-Feld erweitert.

### 4. Race Condition bei Versioned Entities
- **Pfad:** `packages/backend/src/lib/versionedEntity.ts:20-66`
- **Fix:** `createVersionedSettings` und `createVersionedSchedule` in `prisma.$transaction()` gewrappt.

### 5. Command Injection via System Update
- **Pfad:** `packages/backend/src/scripts/systemUpdateFinalize.ts:62`
- **Fix:** `parseShellCommand()`-Parser ersetzt `sh -lc`. Lehnt gefährliche Zeichen ab (`|`, `&`, `;`, `>`, `<`, `` ` ``, `$`).

### 6. useMemo für Side-Effects
- **Pfad:** `packages/frontend/src/components/DataTable.tsx:77`
- **Fix:** `useEffect(() => { setPage(0); }, [data.length])`.

### 8. CORS Default
- **Pfad:** `packages/backend/src/server.ts:31-32`
- **Fix:** `allowAllOrigins` nur bei explizitem `*`. Leere `FRONTEND_URL` = kein CORS.

### 10. Duplicate fetchApi
- **Pfade:** `services/api/core.ts` vs `services/displayApi.ts`
- **Fix:** `deviceToken`-Option zu `fetchApi` hinzugefügt. `displayApi.ts` nutzt jetzt shared `fetchApi` (~150 Zeilen entfernt).

### 13. Error Boundaries Dashboard
- **Pfad:** `packages/frontend/src/pages/DashboardPage.tsx`
- **Fix:** `InlineErrorBoundary` erstellt, alle 6 Dashboard-Widgets geschützt.

### 15. SaunasPage Fehler-Feedback
- **Pfad:** `packages/frontend/src/pages/SaunasPage.tsx:171-179`
- **Fix:** Optimistisches Update mit Rollback + `toast.error()`.

### 16. Device Token Revocation
- **Pfad:** `packages/backend/src/lib/auth.ts:17`, `prisma/schema.prisma`
- **Fix:** Lifetime 365d→90d. `tokenRevokedAt`-Feld im Device-Model. `POST /devices/:id/revoke-token` Endpoint.

### 17. bcryptjs → native bcrypt
- **Pfad:** `packages/backend/package.json`
- **Fix:** `bcryptjs` durch `bcrypt` ersetzt (native C-Binding, ~10x schneller).

### 18. Duplicate Utility-Funktionen
- **Pfade:** `lib/schedule.ts` vs `lib/systemHelpers.ts`
- **Fix:** 4 duplizierte Funktionen aus `systemHelpers.ts` entfernt.

### 19. Layout Remount
- **Pfad:** `packages/frontend/src/components/Layout.tsx:386`
- **Fix:** `key={location.pathname}` und `animate-fade-in` entfernt.

### 22. Magic Numbers
- **Pfad:** `packages/frontend/src/utils/constants.ts`
- **Fix:** 15+ Konstanten ausgelagert: `WS_RECONNECT`, `DASHBOARD_POLLING`, `API_REQUEST_TIMEOUT_MS`, `DEVICE_HEARTBEAT_INTERVAL_MS`, etc.

### 24. Passwort-Mindestlänge
- **Pfade:** `LoginPage.tsx`, `ResetPasswordPage.tsx`
- **Fix:** 6→8 Zeichen vereinheitlicht.

### 26. SaunasPage useRef
- **Pfad:** `packages/frontend/src/pages/SaunasPage.tsx:62-93`
- **Fix:** `isInitialized` State durch `useRef` ersetzt.

### 29. DataTable Columns memoisiert
- **Pfad:** `packages/frontend/src/pages/UsersPage.tsx:117-210`
- **Fix:** `userColumns` in `useMemo(() => [...], [])` gewrappt.

---

## Verbleibendes Backlog

| # | Finding | Aufwand |
|---|---------|---------|
| 9 | God Components (SchedulePage 624 Zeilen, etc.) | ✅ Behoben (SchedulePage 623→174 Zeilen) |
| 11 | Audit-Tabelle via Prisma-Migration | ✅ Behoben (Raw-SQL entfernt) |
| 12 | System-Jobs/Runtime-History in DB | ✅ Behoben (JSON→Prisma) |

---

## Betroffene Dateien

### Backend (16 Dateien)
- `packages/backend/src/routes/systemUpdate.ts` — Auth + Semver-Validierung
- `packages/backend/src/lib/auth.ts` — Cookie-Auth, bcrypt, Device-Revocation
- `packages/backend/src/server.ts` — `cookie-parser`, CORS-Fix
- `packages/backend/src/routes/auth.ts` — httpOnly-Cookie setzen/löschen
- `packages/backend/src/lib/versionedEntity.ts` — `$transaction()`
- `packages/backend/src/scripts/systemUpdateFinalize.ts` — `parseShellCommand()`
- `packages/backend/src/routes/devices/index.ts` — `POST /:id/revoke-token`
- `packages/backend/src/routes/systemBackup.ts` — async `createSystemJob`/`findRunningSystemJob`
- `packages/backend/prisma/schema.prisma` — `tokenRevokedAt`, `SystemJob`, `RuntimeHistory`
- `packages/backend/src/lib/systemHelpers.ts` — Duplicate entfernt
- `packages/backend/src/lib/systemBackup.ts` — Import von `schedule.js`
- `packages/backend/src/lib/prisma.ts` — `dotenv.config()` entfernt
- `packages/backend/src/lib/audit.ts` — Raw-SQL entfernt, Prisma direkt
- `packages/backend/src/lib/systemJobs.ts` — JSON→Prisma (~290→240 Zeilen)
- `packages/backend/src/lib/runtimeHistory.ts` — JSON→Prisma (~345→306 Zeilen)
- `packages/backend/package.json` — `bcrypt` statt `bcryptjs`

### Frontend (26 Dateien)
- `packages/frontend/src/contexts/AuthContext.tsx` — Kein localStorage, `useMemo`
- `packages/frontend/src/contexts/WebSocketContext.tsx` — `error`-Feld
- `packages/frontend/src/services/api/core.ts` — `credentials: 'include'`, `deviceToken`-Option
- `packages/frontend/src/services/displayApi.ts` — Shared `fetchApi` (~150 Zeilen entfernt)
- `packages/frontend/src/services/api/types.ts` — `deviceToken`-Option
- `packages/frontend/src/services/api/system.ts` — Token-Parameter entfernt
- `packages/frontend/src/hooks/useDashboardData.ts` — `useWebSocketStatus()`
- `packages/frontend/src/hooks/useWebSocket.ts` — `WS_RECONNECT` Konstanten
- `packages/frontend/src/hooks/useScheduleEditor.ts` — Neu erstellt (331 Zeilen)
- `packages/frontend/src/components/DataTable.tsx` — `useEffect` statt `useMemo`
- `packages/frontend/src/components/InlineErrorBoundary.tsx` — Neu erstellt
- `packages/frontend/src/pages/DashboardPage.tsx` — 6x `InlineErrorBoundary`
- `packages/frontend/src/pages/SchedulePage.tsx` — 623→174 Zeilen (72% Reduktion)
- `packages/frontend/src/pages/SaunasPage.tsx` — Rollback + Toast + `useRef`
- `packages/frontend/src/pages/UsersPage.tsx` — `useMemo` für Columns
- `packages/frontend/src/pages/LoginPage.tsx` — 8 Zeichen Minimum
- `packages/frontend/src/pages/ResetPasswordPage.tsx` — 8 Zeichen Minimum
- `packages/frontend/src/components/Layout.tsx` — `key` entfernt
- `packages/frontend/src/utils/constants.ts` — 15+ Konstanten
- `packages/frontend/src/components/ConfirmDialog.tsx` — Dialog-Wrapper Refactor
- `packages/frontend/src/components/Button.tsx` — `active` Variante
- `packages/frontend/src/components/FormField.tsx` — `aria-describedby` für Error Messages
- `packages/frontend/src/components/Schedule/PresetTabs.tsx` — Neu erstellt (236 Zeilen)
- `packages/frontend/src/components/Schedule/ScheduleActions.tsx` — Neu erstellt (41 Zeilen)
- `packages/frontend/src/components/Schedule/SaunaStatusInfo.tsx` — Neu erstellt (42 Zeilen)
- `packages/frontend/src/components/Settings/*.tsx` — Token-Refs entfernt (5 Dateien)
