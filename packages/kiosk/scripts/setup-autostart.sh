#!/usr/bin/env bash
# =============================================================================
# HTMLSignage Kiosk — Linux Auto-Start Setup
#
# Dieses Script konfiguriert ein Linux-System als dedizierten Signage-Kiosk:
#   - Erstellt einen systemd-User-Service für automatischen Start
#   - Deaktiviert Bildschirmschoner und DPMS
#   - Deaktiviert Desktop-Benachrichtigungen
#   - Installiert unclutter (Cursor ausblenden)
#
# Verwendung:
#   chmod +x setup-autostart.sh
#   ./setup-autostart.sh [--app-path /pfad/zur/app] [--uninstall]
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_PATH="${SCRIPT_DIR}/.."
SERVICE_NAME="htmlsignage-kiosk"
SERVICE_FILE="${HOME}/.config/systemd/user/${SERVICE_NAME}.service"
AUTOSTART_DIR="${HOME}/.config/autostart"
AUTOSTART_FILE="${AUTOSTART_DIR}/${SERVICE_NAME}.desktop"
UNINSTALL=false

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-path) APP_PATH="$2"; shift 2 ;;
    --uninstall) UNINSTALL=true; shift ;;
    *) echo "Unbekanntes Argument: $1"; exit 1 ;;
  esac
done

APP_PATH="$(cd "$APP_PATH" && pwd)"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

if [ "$UNINSTALL" = true ]; then
  info "Deinstalliere HTMLSignage Kiosk Auto-Start..."

  if systemctl --user is-active "$SERVICE_NAME" &>/dev/null; then
    systemctl --user stop "$SERVICE_NAME"
    info "Service gestoppt."
  fi

  if systemctl --user is-enabled "$SERVICE_NAME" &>/dev/null; then
    systemctl --user disable "$SERVICE_NAME"
    info "Service deaktiviert."
  fi

  [ -f "$SERVICE_FILE" ] && rm -f "$SERVICE_FILE" && info "Service-Datei entfernt."
  [ -f "$AUTOSTART_FILE" ] && rm -f "$AUTOSTART_FILE" && info "Autostart-Datei entfernt."

  systemctl --user daemon-reload 2>/dev/null || true
  info "Deinstallation abgeschlossen."
  exit 0
fi

# ---------------------------------------------------------------------------
# Prüfungen
# ---------------------------------------------------------------------------

# Prüfe ob Electron-App existiert
if [ ! -f "${APP_PATH}/package.json" ]; then
  error "package.json nicht gefunden in ${APP_PATH}"
  error "Bitte --app-path angeben oder Script aus dem kiosk-Verzeichnis ausführen."
  exit 1
fi

# Prüfe ob npx/electron verfügbar
if ! command -v npx &>/dev/null && ! command -v electron &>/dev/null; then
  error "Weder npx noch electron gefunden. Bitte Node.js installieren."
  exit 1
fi

# ---------------------------------------------------------------------------
# Electron-Pfad bestimmen
# ---------------------------------------------------------------------------

if [ -f "${APP_PATH}/node_modules/.bin/electron" ]; then
  ELECTRON_BIN="${APP_PATH}/node_modules/.bin/electron"
elif command -v electron &>/dev/null; then
  ELECTRON_BIN="$(which electron)"
else
  ELECTRON_BIN="npx electron"
fi

info "Electron: ${ELECTRON_BIN}"
info "App-Pfad: ${APP_PATH}"

# ---------------------------------------------------------------------------
# 1. Systemd User-Service erstellen
# ---------------------------------------------------------------------------

info "Erstelle systemd User-Service..."

mkdir -p "$(dirname "$SERVICE_FILE")"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=HTMLSignage Kiosk Display Client
After=graphical-session.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${ELECTRON_BIN} ${APP_PATH}
WorkingDirectory=${APP_PATH}
Restart=always
RestartSec=5
Environment=DISPLAY=:0
Environment=XAUTHORITY=${HOME}/.Xauthority
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"
info "Systemd-Service erstellt und aktiviert: ${SERVICE_FILE}"

# ---------------------------------------------------------------------------
# 2. XDG Autostart (.desktop) als Fallback
# ---------------------------------------------------------------------------

info "Erstelle XDG Autostart-Eintrag..."

mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=HTMLSignage Kiosk
Comment=HTMLSignage Display im Kiosk-Modus
Exec=${ELECTRON_BIN} ${APP_PATH}
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=5
EOF

info "Autostart-Datei erstellt: ${AUTOSTART_FILE}"

# ---------------------------------------------------------------------------
# 3. Bildschirmschoner & DPMS deaktivieren
# ---------------------------------------------------------------------------

info "Deaktiviere Bildschirmschoner und DPMS..."

# X11 / xset
if command -v xset &>/dev/null; then
  xset s off 2>/dev/null || true      # Screensaver aus
  xset s noblank 2>/dev/null || true   # Kein Blanking
  xset -dpms 2>/dev/null || true       # DPMS aus
  info "xset: Screensaver und DPMS deaktiviert."
fi

# GNOME
if command -v gsettings &>/dev/null; then
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true
  gsettings set org.gnome.desktop.screensaver idle-activation-enabled false 2>/dev/null || true
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
  info "GNOME: Screensaver und Idle deaktiviert."
fi

# XFCE
if command -v xfconf-query &>/dev/null; then
  xfconf-query -c xfce4-screensaver -p /saver/enabled -s false 2>/dev/null || true
  xfconf-query -c xfce4-power-manager -p /xfce4-power-manager/dpms-enabled -s false 2>/dev/null || true
  info "XFCE: Screensaver und DPMS deaktiviert."
fi

# ---------------------------------------------------------------------------
# 4. Desktop-Benachrichtigungen deaktivieren
# ---------------------------------------------------------------------------

info "Deaktiviere Desktop-Benachrichtigungen..."

# GNOME
if command -v gsettings &>/dev/null; then
  gsettings set org.gnome.desktop.notifications show-banners false 2>/dev/null || true
  gsettings set org.gnome.desktop.notifications show-in-lock-screen false 2>/dev/null || true
  info "GNOME: Benachrichtigungen deaktiviert."
fi

# XFCE
if command -v xfconf-query &>/dev/null; then
  xfconf-query -c xfce4-notifyd -p /do-not-disturb -s true 2>/dev/null || true
  info "XFCE: Do-Not-Disturb aktiviert."
fi

# KDE
if command -v kwriteconfig5 &>/dev/null; then
  kwriteconfig5 --file notificationrc --group DoNotDisturb --key Until "2100-01-01T00:00" 2>/dev/null || true
  kwriteconfig5 --file notificationrc --group DoNotDisturb --key TurnedOn true 2>/dev/null || true
  info "KDE: Do-Not-Disturb aktiviert."
fi

# ---------------------------------------------------------------------------
# 5. unclutter installieren (Cursor ausblenden)
# ---------------------------------------------------------------------------

if ! command -v unclutter &>/dev/null; then
  info "Installiere unclutter (Cursor nach Inaktivität ausblenden)..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y unclutter 2>/dev/null && info "unclutter installiert." || warn "unclutter konnte nicht installiert werden (sudo erforderlich)."
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm unclutter 2>/dev/null && info "unclutter installiert." || warn "unclutter konnte nicht installiert werden."
  else
    warn "Paketmanager nicht erkannt — bitte unclutter manuell installieren."
  fi
else
  info "unclutter bereits installiert."
fi

# ---------------------------------------------------------------------------
# Zusammenfassung
# ---------------------------------------------------------------------------

echo ""
echo "============================================="
info "HTMLSignage Kiosk Setup abgeschlossen!"
echo "============================================="
echo ""
echo "  Service:   systemctl --user status ${SERVICE_NAME}"
echo "  Starten:   systemctl --user start ${SERVICE_NAME}"
echo "  Stoppen:   systemctl --user stop ${SERVICE_NAME}"
echo "  Logs:      journalctl --user -u ${SERVICE_NAME} -f"
echo "  Entfernen: $0 --uninstall"
echo ""
info "Der Kiosk startet automatisch beim nächsten Login."
echo ""
