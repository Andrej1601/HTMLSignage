# Refactoring Baseline

Stand: 2026-03-20

## Ziel

Diese Baseline dokumentiert die größten Refactor-Hotspots im aktuellen Repo-Stand, die vorhandene Absicherung und eine kleine, kontrollierte Schrittfolge. Sie ist bewusst kein Redesign-Plan, sondern ein Sicherheitsnetz für verhaltensbewahrende Refactors.

## Aktuelle Sicherheitsbasis

- `pnpm -C /opt/HTMLSignage typecheck`
- `pnpm -C /opt/HTMLSignage test:backend`
- `pnpm -C /opt/HTMLSignage smoke -- --frontend-url http://127.0.0.1:5173 --backend-url http://127.0.0.1:3000`

Zuletzt geprüft: grün.

## Größte Hotspots

### Frontend

#### `packages/frontend/src/services/api.ts`

- Eine Datei vereint DTO-Typen, Transport-Helfer, Fehlerbehandlung, Fallback-Logik und domänenspezifische API-Clients.
- UI-nahe Aufrufer hängen an einer gemeinsamen, breiten Exportfläche.
- Besonders riskant sind gemischte Verantwortungen zwischen:
  - HTTP-Core
  - Display-Config-Fallback
  - Domänenclients für Schedule, Settings, Devices, Media, System und Workflow

#### `packages/frontend/src/components/Settings/EventManager.tsx`

- Große Orchestrator-Komponente mit gemischter Zuständigkeit für:
  - Formularzustand
  - Normalisierung
  - Validierung
  - Abschnittsrendering
  - Dialog- und Listenlogik
- Erschwert isolierte Tests und macht Seiteneffekte im JSX schwer sichtbar.

#### `packages/frontend/src/pages/SlideshowPage.tsx`

- Mischt Seitenorchestrierung, Workflow-Integration, UI-Zustand und transformationslastige Logik.
- Gute Kandidaten für spätere Extraktion:
  - View-Model-/Dirty-State-Logik
  - Workflow-spezifische Mapper
  - Renderabschnitte

#### `packages/frontend/src/pages/SchedulePage.tsx`

- Enthält Seitenzustand, Entwurfslogik, Editorsteuerung und größere Transformationsblöcke in einer Datei.
- Vergleichs- und Save-Pfade sind funktional wichtig und müssen vor Zerlegung per Smoke-Pfad abgesichert bleiben.

#### `packages/frontend/src/hooks/useDashboardData.ts`

- Aggregiert viele Abfragen, Fingerprints, Mappings und Ableitungen in einem Hook.
- Hohe Nutzlast für das Dashboard, aber aktuell schwer zu isolieren.

#### `packages/frontend/src/components/Display/TimelineScheduleSlide.tsx`

- Großer Render- und Layoutblock mit Darstellungs-, Zeit- und Stilentscheidungen an einem Ort.
- Vor weiterer Zerlegung ist die aktuelle Verantwortung gegen bestehende Display-Refactors abzugrenzen.

#### `packages/frontend/src/hooks/useDisplayClientRuntime.ts`

- Geschäftskritischer Laufzeitpfad.
- Vereint Pairing, Config-Refresh, Bridge-Kommunikation, Heartbeats, lokale Persistence und Socket-Verhalten.
- Refactors hier nur mit besonders kleinem Schnitt.

### Backend

#### `packages/backend/src/routes/devices.ts`

- Route-Datei mit gemischten Verantwortungen für:
  - Validierung
  - Controller-Verhalten
  - Prisma-Zugriffe
  - Broadcast-/Control-Nebenwirkungen
  - Audit-/Fehlerpfade

#### `packages/backend/src/lib/systemHelpers.ts`

- Viele operative Hilfen an einer Stelle.
- Gute Kandidaten für spätere Trennung:
  - Preflight-/Verification-Logik
  - Git-/Build-/Restart-nahe Operationen
  - Fehlerklassifikation

#### `packages/backend/src/lib/maintenance.ts`

- Housekeeping, Retention und Runtime-Nebenwirkungen leben nahe beieinander.
- Funktional wertvoll, aber strukturell dicht.

#### `packages/backend/src/routes/slideshowWorkflow.ts`

- HTTP-Route plus Workflow-Schreiblogik plus Historien-/Rollback-Pfade.
- Guter Kandidat für Controller- und Operations-Trennung.

#### `packages/backend/src/lib/systemBackup.ts`

- Bereits besser strukturiert als frühere Monolithen, aber weiterhin schwergewichtig.
- Eher ein Kandidat für spätere Konsolidierung als für den ersten Schnitt.

## Zusätzliche Beobachtungen

- Die aktuelle Testabdeckung ist sehr schmal. Im Repo existiert derzeit nur ein kleines Backend-Testfile.
- Der Worktree enthält bereits produktive Live-/Display-Anpassungen und Rollout-Artefakte. Refactors müssen deshalb kompatibel und eng geschnitten bleiben.
- Frontend- und Display-Refactors sollten bestehende Pfade nicht gleichzeitig optisch und strukturell verändern.

## Refactor-Sicherheitsnetz nach Bereich

### Admin / API

Vor und nach API-Refactors prüfen:

- Login/Session (`/login`, `/auth/me`)
- Dashboard (`/`)
- Devices (`/devices`)
- Schedule (`/schedule`)
- Slideshow (`/slideshow`)
- Settings (`/settings`)

### Display

Vor und nach Display-Refactors prüfen:

- `/display`
- `/display?preview=1`
- Triple-, Split- und Full-Rotation-Pfade
- Gerätebezogene Vorschau mit Wartungsmodus

### System / Backend

Vor und nach Backend-Refactors prüfen:

- `/health`
- Runtime-Dashboard-Daten
- Systemjobs
- Backup-/Update-Status
- Geräte-API-Basispfade

## Kleine Schrittfolge

### Sprint 1

- Baseline und Sicherheitsnetz dokumentieren
- Hotspots und Smoke-Pfade explizit machen

### Sprint 2

- `services/api.ts` in kleinere Domänenmodule zerlegen
- Öffentliche Importfläche kompatibel halten
- DTO-Typen, Transport-Core und Domänenclients trennen

### Sprint 3

- `EventManager`, `SlideshowPage`, `SchedulePage` schrittweise zerlegen
- Reine Hilfslogik aus JSX und Seitenorchestrierung herausziehen

### Sprint 4

- Display-Pfad weiter entflechten
- Fokus auf `TimelineScheduleSlide`, `EventsSlide`, `SaunaDetailDashboard`, `useDisplayClientRuntime`

### Sprint 5

- Backend-Routen in Controller-/Operations-/Mapper-Schichten schneiden

### Sprint 6

- Benennungen, Seiteneffekte und Fehlerverhalten vereinheitlichen

### Sprint 7

- Testnetz für neue Grenzen ergänzen

## Definition von Erfolg

- Kleinere und klarer benannte Einheiten
- Weniger gemischte Verantwortungen
- Weniger implizite Seiteneffekte
- Bessere Testbarkeit
- Gleiches Fachverhalten
- Grüne Checks nach jedem Sprint
