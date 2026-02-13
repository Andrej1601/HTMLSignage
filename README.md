# HTMLSignage

Digital-Signage-System fuer Sauna- und Wellnessbereiche auf Basis von TypeScript, React und Express.

Diese Dokumentation ist als Betriebs- und Installationsleitfaden aufgebaut:
- Was das System kann
- Wie es auf einer neuen Maschine installiert wird
- Wie es betrieben, aktualisiert und konfiguriert wird
- Wie typische Fehler schnell behoben werden

## Inhaltsverzeichnis
1. [Systemueberblick](#systemueberblick)
2. [Funktionsumfang](#funktionsumfang)
3. [Architektur und Ports](#architektur-und-ports)
4. [Schnellstart auf neuer Maschine (Installer)](#schnellstart-auf-neuer-maschine-installer)
5. [Installer-Parameter](#installer-parameter)
6. [Erstkonfiguration nach Installation](#erstkonfiguration-nach-installation)
7. [Lokale Entwicklung](#lokale-entwicklung)
8. [Konfiguration](#konfiguration)
9. [Betrieb und Wartung](#betrieb-und-wartung)
10. [API-Uebersicht](#api-uebersicht)
11. [Projektstruktur](#projektstruktur)
12. [Troubleshooting](#troubleshooting)

## Systemueberblick
HTMLSignage besteht aus zwei Hauptkomponenten:
- `Frontend` (React + Vite) auf Port `5173`
- `Backend` (Express + Prisma) auf Port `3000`

Persistenz:
- PostgreSQL als Datenbank
- Upload-Dateien unter `packages/backend/uploads`

Zielplattform:
- Ubuntu/Debian (Installer ist darauf ausgelegt)
- Betrieb in beliebigen LANs ohne feste IP-Annahmen

## Funktionsumfang

### Admin-Oberflaeche
Routen (Frontend):
- `/` Dashboard
- `/schedule` Aufgussplan bearbeiten
- `/saunas` Saunen verwalten
- `/slideshow` Slides/Layouteinstellungen
- `/settings` Design/Farben/Systemeinstellungen
- `/devices` Geraeteverwaltung + Pairing
- `/users` Benutzerverwaltung (Admin)
- `/media` Medienbibliothek und Upload
- `/login` Login

### Display-Client
Route:
- `/display`

Funktionen:
- Slideshow-Wiedergabe basierend auf konfigurierten Slides
- Live-Updates ueber WebSocket
- Heartbeat an Backend

### Medienverwaltung
- Upload von Bild/Audio/Video
- Loeschen und Filtern/Suchen
- **Multi-Datei-Upload per Drag-and-Drop**
  - mehrere Dateien gleichzeitig in den Uploadbereich ziehen
  - sequentieller Upload mit Fortschrittsanzeige
  - Fehler pro Datei, erfolgreiche Uploads bleiben erhalten

Unterstuetzte Formate:
- Bild: JPG, PNG, GIF, WebP, SVG
- Audio: MP3, WAV, OGG
- Video: MP4, WebM
- Maximale Dateigroesse pro Datei: 50 MB

## Architektur und Ports

### Netzwerk
- Frontend lauscht auf `0.0.0.0:5173`
- Backend lauscht auf `0.0.0.0:3000`

### Kommunikation
- Frontend nutzt API-Endpunkte unter `/api`
- Backend stellt Uploads unter `/uploads` bereit
- WebSocket fuer Live-Sync

### CORS
- Gesteuert ueber `FRONTEND_URL` im Backend
- Installer-Standard: `FRONTEND_URL="*"` (kein fester Host/IP erforderlich)

## Schnellstart auf neuer Maschine (Installer)

### Voraussetzungen
Auf Zielmaschine:
- Ubuntu/Debian
- sudo-Rechte
- Internetzugang

### Schritt-fuer-Schritt
```bash
sudo apt update
sudo apt install -y git curl ca-certificates

git clone https://github.com/Andrej1601/HTMLSignage.git /opt/HTMLSignage
cd /opt/HTMLSignage

sudo APP_USER="$USER" bash scripts/install-new-machine.sh
```

### Was der Installer automatisch macht
1. Systempakete installieren/aktualisieren
2. Neueste verfuegbare Node.js-Version von NodeSource installieren (`setup_current.x`)
3. pnpm via corepack aktivieren
4. Repository auf `main` klonen/aktualisieren
5. Dependencies installieren (`pnpm install --no-frozen-lockfile`)
6. PostgreSQL einrichten (DB + User)
7. `.env`-Dateien fuer Backend/Frontend erzeugen
8. Prisma Client generieren + Migrationen ausfuehren
9. Frontend/Backend bauen
10. systemd-Services erstellen und starten:
   - `htmlsignage-backend.service`
   - `htmlsignage-frontend.service`
11. Optional Firewall-Regeln (wenn `ufw` aktiv ist)
12. Health-Checks ausfuehren

### Verifikation nach Installation
```bash
systemctl status htmlsignage-backend.service --no-pager
systemctl status htmlsignage-frontend.service --no-pager
ss -tulpen | grep -E ':(3000|5173)\b'
curl http://127.0.0.1:3000/health
```

### Zugriff
- Admin: `http://<machine-ip-or-hostname>:5173`
- Display: `http://<machine-ip-or-hostname>:5173/display`
- API Health: `http://<machine-ip-or-hostname>:3000/health`

## Installer-Parameter
Folgende Variablen koennen beim Aufruf gesetzt werden:

```bash
sudo \
  APP_USER="$USER" \
  APP_DIR="/opt/HTMLSignage" \
  BRANCH="main" \
  DB_NAME="htmlsignage" \
  DB_USER="signage" \
  DB_PASS="<starkes-passwort>" \
  BACKEND_PORT="3000" \
  FRONTEND_PORT="5173" \
  FRONTEND_URL="*" \
  VITE_API_URL="" \
  JWT_SECRET="<starkes-secret>" \
  bash scripts/install-new-machine.sh
```

Bedeutung:
- `APP_USER`: Linux-User, unter dem Services laufen
- `APP_DIR`: Installationspfad
- `BRANCH`: Git-Branch fuer Deployment
- `DB_*`: PostgreSQL-Zugang
- `BACKEND_PORT`, `FRONTEND_PORT`: Service-Ports
- `FRONTEND_URL`: CORS-Whitelist (`*` erlaubt alle)
- `VITE_API_URL`: Optional feste API-URL fuer Frontend-Build
  - leer: Frontend nutzt dynamischen Fallback (Host der aktuellen Seite + Port 3000)
- `JWT_SECRET`: Signierschluessel fuer Auth-Tokens

## Erstkonfiguration nach Installation
1. Frontend im Browser oeffnen
2. Ersten Benutzer registrieren
3. Der erste registrierte Benutzer bekommt Admin-Rechte
4. Danach Login und Konfiguration (Saunen, Schedule, Slideshow, Settings)

## Lokale Entwicklung

### Voraussetzungen
- Node.js >= 20
- PostgreSQL

### Setup
```bash
npx pnpm install
cp packages/backend/.env.example packages/backend/.env
npx pnpm --filter backend db:generate
npx pnpm --filter backend db:migrate
npx pnpm dev
```

### Entwicklungs-URLs
- Frontend: `http://localhost:5173`
- Display: `http://localhost:5173/display`
- Backend: `http://localhost:3000`

## Konfiguration

### Backend: `packages/backend/.env`
Beispiel:
```env
DATABASE_URL="postgresql://signage:password@localhost:5432/htmlsignage?schema=public"
PORT=3000
NODE_ENV=production
FRONTEND_URL=*
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
SESSION_DURATION=604800
```

### Frontend: `packages/frontend/.env.production`
```env
VITE_API_URL=
```

Hinweis:
- leer = dynamische API-Aufloesung (aktueller Host + `:3000`)
- gesetzt = explizite API-URL

### Vite Dev Proxy
In `packages/frontend/vite.config.ts`:
- `VITE_DEV_API_TARGET` kann fuer lokales Development gesetzt werden
- Default: `http://localhost:3000`

## Betrieb und Wartung

### Service-Status und Logs
```bash
systemctl status htmlsignage-backend.service
systemctl status htmlsignage-frontend.service

journalctl -u htmlsignage-backend.service -f
journalctl -u htmlsignage-frontend.service -f
```

### Services neu starten
```bash
sudo systemctl restart htmlsignage-backend.service
sudo systemctl restart htmlsignage-frontend.service
```

### Update auf neue Version
```bash
cd /opt/HTMLSignage
git pull --ff-only origin main
sudo APP_USER="$USER" bash scripts/install-new-machine.sh
```

### Build manuell
```bash
cd /opt/HTMLSignage
npx pnpm build
```

## API-Uebersicht

### Auth
- `POST /api/auth/register` (nur fuer ersten Benutzer)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users (admin)
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### Schedule
- `GET /api/schedule`
- `GET /api/schedule/history`
- `POST /api/schedule`
- `GET /api/schedule/:id`

### Settings
- `GET /api/settings`
- `POST /api/settings`

### Devices
- `GET /api/devices`
- `GET /api/devices/pending`
- `GET /api/devices/:id`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`
- `POST /api/devices/:id/heartbeat`
- `POST /api/devices/:id/control`
- `POST /api/devices/:id/overrides`
- `DELETE /api/devices/:id/overrides`
- `POST /api/devices/request-pairing`
- `POST /api/devices/pair`

### Media
- `GET /api/media`
- `GET /api/media/:id`
- `POST /api/media/upload`
- `DELETE /api/media/:id`

### Health
- `GET /health`

## Projektstruktur
```text
HTMLSignage/
  packages/
    backend/
      prisma/
      src/
      uploads/
    frontend/
      src/
  scripts/
    install-new-machine.sh
```

## Troubleshooting

### Frontend laeuft, aber API nicht erreichbar
Pruefen:
```bash
curl http://127.0.0.1:3000/health
```
Wenn Fehler:
```bash
systemctl status htmlsignage-backend.service --no-pager
journalctl -u htmlsignage-backend.service -n 200 --no-pager
```

### Ports bereits belegt
```bash
ss -tulpen | grep -E ':(3000|5173)\b'
```
Dann Konfliktprozess stoppen oder Ports per Installer-Variablen aendern.

### Datenbank-Probleme
```bash
systemctl status postgresql --no-pager
sudo -u postgres psql -c "\l"
```

### Migration fehlgeschlagen
```bash
cd /opt/HTMLSignage/packages/backend
npx prisma generate
npx prisma migrate deploy
```

### Upload funktioniert nicht
Pruefen:
- Schreibrechte in `packages/backend/uploads`
- Dateityp/Dateigroesse innerhalb erlaubter Limits
- Backend-Logs fuer Multer/Prisma-Fehler

### Auth-Probleme
- Erster Benutzer kann nur einmal via `/api/auth/register` angelegt werden
- Danach User-Verwaltung ueber `/users` (Admin)

## Lizenz
Projektspezifisch / intern.
