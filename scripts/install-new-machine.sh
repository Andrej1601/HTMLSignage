#!/usr/bin/env bash
set -Eeuo pipefail

# HTMLSignage v2 — Production Installer
# Supports both fresh installs and updates after git pull.
# Uses whiptail dialogs for interactive configuration on fresh installs.
# On updates, preserves existing .env and only rebuilds/restarts.
#
# Usage:
#   sudo bash scripts/install-new-machine.sh            # interactive
#   sudo bash scripts/install-new-machine.sh --update    # skip dialogs, update only
#   sudo BACKEND_PORT=3000 bash scripts/install-new-machine.sh  # env overrides still work

# ── Guard ────────────────────────────────────────────────────────────────────
if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash scripts/install-new-machine.sh"
  exit 1
fi

# ── Logging helpers ──────────────────────────────────────────────────────────
log()  { echo "[install] $*"; }
warn() { echo "[install][warn] $*" >&2; }
die()  { echo "[install][error] $*" >&2; exit 1; }
INSTALL_LOG="${INSTALL_LOG:-/var/log/htmlsignage-installer.log}"

is_true() {
  case "${1,,}" in
    1|true|yes|y|on) return 0 ;;
    *) return 1 ;;
  esac
}

CURRENT_STEP="initialization"
on_error() {
  local exit_code="$1"
  local line_no="$2"
  echo
  echo "[install][error] Step '${CURRENT_STEP}' failed at line ${line_no} (exit ${exit_code})." >&2
  echo "[install][error] Check installer log: ${INSTALL_LOG}" >&2
  exit "${exit_code}"
}
trap 'on_error $? $LINENO' ERR

step() {
  CURRENT_STEP="$1"
  echo
  log "==== ${CURRENT_STEP} ===="
}

wait_for_url() {
  local label="$1" url="$2" retries="$3" delay="$4" i
  for ((i = 1; i <= retries; i++)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      log "${label} is reachable (${url})"
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

cleanup_pnpm_bins() {
  local remove_all="${1:-false}" bin
  for bin in /usr/bin/pnpm /usr/bin/pnpx /usr/local/bin/pnpm /usr/local/bin/pnpx; do
    if [[ "${remove_all}" == "true" ]]; then
      [[ -e "${bin}" || -L "${bin}" ]] && rm -f "${bin}"
      continue
    fi
    if [[ -L "${bin}" && ! -e "${bin}" ]]; then
      log "Removing broken pnpm symlink: ${bin}"
      rm -f "${bin}"
    elif [[ -e "${bin}" && ! -x "${bin}" ]]; then
      log "Removing unusable pnpm binary: ${bin}"
      rm -f "${bin}"
    fi
  done
}

# ── Whiptail dialog helpers ──────────────────────────────────────────────────
HAS_WHIPTAIL="false"
if command -v whiptail >/dev/null 2>&1; then
  HAS_WHIPTAIL="true"
fi

# Ask user for input via whiptail, fall back to read if unavailable.
# Usage: ask_input "title" "prompt" "default"
ask_input() {
  local title="$1" prompt="$2" default="$3" result
  if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
    result="$(whiptail --title "${title}" --inputbox "${prompt}" 10 70 "${default}" 3>&1 1>&2 2>&3)" || result="${default}"
  else
    echo -n "[input] ${prompt} [${default}]: " >&2
    read -r result
    [[ -z "${result}" ]] && result="${default}"
  fi
  echo "${result}"
}

# Ask user for password via whiptail (hidden input).
# Usage: ask_password "title" "prompt" "default"
ask_password() {
  local title="$1" prompt="$2" default="$3" result
  if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
    result="$(whiptail --title "${title}" --passwordbox "${prompt}" 10 70 "${default}" 3>&1 1>&2 2>&3)" || result="${default}"
  else
    echo -n "[input] ${prompt} [****]: " >&2
    read -rs result
    echo >&2
    [[ -z "${result}" ]] && result="${default}"
  fi
  echo "${result}"
}

# Yes/No dialog. Returns 0 for yes, 1 for no.
# Usage: ask_yesno "title" "prompt" && echo "yes"
ask_yesno() {
  local title="$1" prompt="$2"
  if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
    whiptail --title "${title}" --yesno "${prompt}" 10 70 3>&1 1>&2 2>&3
  else
    echo -n "[input] ${prompt} [Y/n]: " >&2
    local answer
    read -r answer
    [[ -z "${answer}" || "${answer,,}" == "y" || "${answer,,}" == "yes" ]]
  fi
}

# Show info message
show_info() {
  local title="$1" message="$2"
  if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
    whiptail --title "${title}" --msgbox "${message}" 12 70
  else
    echo "[info] ${message}" >&2
  fi
}

# ── Detect install mode ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-/opt/HTMLSignage}"
APP_USER="${APP_USER:-${SUDO_USER:-andrej}}"

# Detect current branch from the repo we're in
DEFAULT_BRANCH="main"
if git -C "${SCRIPT_DIR}/.." rev-parse --git-dir >/dev/null 2>&1; then
  DETECTED_BRANCH="$(git -C "${SCRIPT_DIR}/.." rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  if [[ -n "${DETECTED_BRANCH}" && "${DETECTED_BRANCH}" != "HEAD" ]]; then
    DEFAULT_BRANCH="${DETECTED_BRANCH}"
  fi
fi
BRANCH="${BRANCH:-${DEFAULT_BRANCH}}"

# Determine if this is an update or fresh install
IS_UPDATE="false"
FORCE_UPDATE="false"
BACKEND_ENV="${APP_DIR}/packages/backend/.env"
FRONTEND_ENV="${APP_DIR}/packages/frontend/.env.production"
EXISTING_DB_URL=""
EXISTING_JWT=""
EXISTING_FRONTEND_PORT=""

for arg in "$@"; do
  case "${arg}" in
    --update) FORCE_UPDATE="true" ;;
  esac
done

if [[ -f "${BACKEND_ENV}" && -d "${APP_DIR}/.git" ]]; then
  IS_UPDATE="true"
fi
if [[ "${FORCE_UPDATE}" == "true" ]]; then
  IS_UPDATE="true"
fi

# ── Setup logging ────────────────────────────────────────────────────────────
mkdir -p "$(dirname "${INSTALL_LOG}")"
touch "${INSTALL_LOG}"
chmod 600 "${INSTALL_LOG}" || true
exec > >(tee -a "${INSTALL_LOG}") 2>&1

# ── Defaults ─────────────────────────────────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/Andrej1601/HTMLSignage.git}"
DB_NAME="${DB_NAME:-htmlsignage}"
DB_USER="${DB_USER:-signage}"
DB_PASS="${DB_PASS:-}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_URL="${FRONTEND_URL:-}"
VITE_API_URL="${VITE_API_URL:-}"
RESET_PASSWORD_URL_BASE="${RESET_PASSWORD_URL_BASE:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
MAIL_FROM="${MAIL_FROM:-}"
JWT_SECRET="${JWT_SECRET:-}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="${PNPM_VERSION:-10.31.0}"
CLEAN_INSTALL="${CLEAN_INSTALL:-false}"
APT_UPGRADE="${APT_UPGRADE:-false}"
SKIP_HEALTHCHECKS="${SKIP_HEALTHCHECKS:-false}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-45}"
HEALTHCHECK_DELAY="${HEALTHCHECK_DELAY:-2}"

# ── Interactive configuration (fresh install only) ───────────────────────────
if [[ "${IS_UPDATE}" == "true" ]]; then
  log "Update-Modus: Bestehende Konfiguration wird beibehalten."

  # Parse existing .env to get ports for service files and health checks
  if [[ -f "${BACKEND_ENV}" ]]; then
    BACKEND_PORT="$(grep -oP '^PORT=\K.*' "${BACKEND_ENV}" 2>/dev/null || echo "${BACKEND_PORT}")"
    # Read existing DB credentials for Prisma migrations
    EXISTING_DB_URL="$(grep -oP '^DATABASE_URL="\K[^"]+' "${BACKEND_ENV}" 2>/dev/null || true)"
    EXISTING_JWT="$(grep -oP '^JWT_SECRET=\K.*' "${BACKEND_ENV}" 2>/dev/null || true)"
    [[ -n "${EXISTING_JWT}" ]] && JWT_SECRET="${EXISTING_JWT}"
  fi
  if [[ -f "${FRONTEND_ENV}" ]]; then
    VITE_API_URL="$(grep -oP '^VITE_API_URL=\K.*' "${FRONTEND_ENV}" 2>/dev/null || echo "${VITE_API_URL}")"
  fi
  EXISTING_FRONTEND_PORT="$(grep -oP '^Environment=PORT=\K[0-9]+' /etc/systemd/system/htmlsignage-frontend.service 2>/dev/null || true)"
  if [[ -z "${EXISTING_FRONTEND_PORT}" ]]; then
    EXISTING_FRONTEND_PORT="$(grep -oP -- '--port \K[0-9]+' /etc/systemd/system/htmlsignage-frontend.service 2>/dev/null || true)"
  fi
  [[ -n "${EXISTING_FRONTEND_PORT}" ]] && FRONTEND_PORT="${EXISTING_FRONTEND_PORT}"

  # Validate critical secrets exist in update mode
  if [[ -z "${EXISTING_JWT}" ]]; then
    warn "JWT_SECRET fehlt in ${BACKEND_ENV} — generiere neuen Wert."
    warn "ACHTUNG: Alle bestehenden Sessions werden ungueltig!"
    JWT_SECRET="$(openssl rand -hex 32)"
  fi
  if [[ ! -f "${BACKEND_ENV}" ]]; then
    warn "Backend .env fehlt (${BACKEND_ENV}). Wechsle zu Neuinstallations-Modus fuer Konfiguration."
    IS_UPDATE="false"
  fi

else
  # Fresh install — ask user for configuration via dialogs
  ACCESS_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -z "${ACCESS_HOST}" ]] && ACCESS_HOST="$(hostname)"

  if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
    show_info "HTMLSignage Installer" "Willkommen zum HTMLSignage Installer!\n\nEs werden nun einige Konfigurationswerte abgefragt.\nBei jedem Feld wird ein sinnvoller Standardwert vorgeschlagen.\n\nDruecke Enter um den Standardwert zu uebernehmen."
  fi

  APP_USER="$(ask_input "Betriebssystem-User" "Unter welchem System-Benutzer soll HTMLSignage laufen?" "${APP_USER}")"
  BACKEND_PORT="$(ask_input "Backend-Port" "Port fuer die Backend-API:" "${BACKEND_PORT}")"
  FRONTEND_PORT="$(ask_input "Frontend-Port" "Port fuer die Admin-Oberflaeche:" "${FRONTEND_PORT}")"

  DEFAULT_FRONTEND_URL="http://${ACCESS_HOST}:${FRONTEND_PORT}"
  FRONTEND_URL="$(ask_input "Frontend-URL" "Oeffentliche URL des Frontends (fuer CORS):" "${DEFAULT_FRONTEND_URL}")"

  if [[ -z "${VITE_API_URL}" ]]; then
    VITE_API_URL="http://${ACCESS_HOST}:${BACKEND_PORT}"
  fi
  VITE_API_URL="$(ask_input "API-URL" "URL der Backend-API (vom Browser aus erreichbar):" "${VITE_API_URL}")"

  DB_NAME="$(ask_input "Datenbank" "Name der PostgreSQL-Datenbank:" "${DB_NAME}")"
  DB_USER="$(ask_input "Datenbank-User" "PostgreSQL-Benutzername:" "${DB_USER}")"
  if [[ -z "${DB_PASS}" ]]; then
    DB_PASS="$(openssl rand -hex 18)"
  fi

  if [[ -z "${JWT_SECRET}" ]]; then
    JWT_SECRET="$(openssl rand -hex 32)"
  fi

  if ask_yesno "E-Mail / SMTP" "Moechtest du SMTP fuer Passwort-Reset konfigurieren?\n(Kann spaeter in der .env nachgetragen werden)"; then
    SMTP_HOST="$(ask_input "SMTP Host" "SMTP-Server Adresse:" "${SMTP_HOST}")"
    SMTP_PORT="$(ask_input "SMTP Port" "SMTP Port:" "${SMTP_PORT}")"
    SMTP_USER="$(ask_input "SMTP User" "SMTP Benutzername:" "${SMTP_USER}")"
    SMTP_PASS="$(ask_password "SMTP Passwort" "SMTP Passwort:" "${SMTP_PASS}")"
    MAIL_FROM="$(ask_input "Absender" "Absender-E-Mail (z.B. noreply@example.com):" "${MAIL_FROM}")"
    RESET_PASSWORD_URL_BASE="${FRONTEND_URL}"
  fi

  if [[ -z "${RESET_PASSWORD_URL_BASE}" && "${FRONTEND_URL}" != "*" ]]; then
    RESET_PASSWORD_URL_BASE="${FRONTEND_URL}"
  fi
fi

# ── Validation ───────────────────────────────────────────────────────────────
[[ -n "${APP_DIR}" && "${APP_DIR}" != "/" ]] || die "APP_DIR must not be empty or '/'."
[[ "${APP_DIR}" == /* ]] || die "APP_DIR must be an absolute path."
[[ "${NODE_MAJOR}" =~ ^[0-9]+$ ]] || die "NODE_MAJOR must be numeric."
[[ "${BACKEND_PORT}" =~ ^[0-9]+$ ]] || die "BACKEND_PORT must be numeric."
[[ "${FRONTEND_PORT}" =~ ^[0-9]+$ ]] || die "FRONTEND_PORT must be numeric."
(( BACKEND_PORT >= 1 && BACKEND_PORT <= 65535 )) || die "BACKEND_PORT out of range."
(( FRONTEND_PORT >= 1 && FRONTEND_PORT <= 65535 )) || die "FRONTEND_PORT out of range."
[[ "${DB_USER}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || die "DB_USER must match [a-zA-Z_][a-zA-Z0-9_]*"
[[ "${DB_NAME}" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || die "DB_NAME must match [a-zA-Z_][a-zA-Z0-9_]*"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  die "User '${APP_USER}' does not exist. Create the user first or pass APP_USER=<existing-user>."
fi

step "Configuration"
log "MODE=$(if [[ "${IS_UPDATE}" == "true" ]]; then echo "UPDATE"; else echo "FRESH INSTALL"; fi)"
log "APP_DIR=${APP_DIR}"
log "APP_USER=${APP_USER}"
log "REPO=${REPO_URL} (${BRANCH})"
log "PORTS frontend=${FRONTEND_PORT} backend=${BACKEND_PORT}"
log "DATABASE ${DB_USER}@${DB_NAME}"
log "NODE_MAJOR=${NODE_MAJOR}"
log "PNPM_VERSION=${PNPM_VERSION}"
log "INSTALL_LOG=${INSTALL_LOG}"

# ── System packages ──────────────────────────────────────────────────────────
step "Installing base packages"
export DEBIAN_FRONTEND=noninteractive

# Stop unattended-upgrades which may hold the dpkg lock
log "Stopping unattended-upgrades to release dpkg lock..."
systemctl stop unattended-upgrades 2>/dev/null || true
killall -9 unattended-upgrades 2>/dev/null || true

# Wait for dpkg lock to be released
log "Waiting for dpkg lock to be released..."
for ((i = 1; i <= 120; i++)); do
  if ! fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; then
    log "dpkg lock released after ${i}s"
    break
  fi
  if (( i % 10 == 0 )); then
    log "Still waiting for dpkg lock (${i}s elapsed)..."
  fi
  sleep 1
done

# Retry apt-get if it still fails (lock may be re-acquired)
retry_apt() {
  local max=3 i=0
  while (( i < max )); do
    if "$@"; then
      return 0
    fi
    (( i++ ))
    log "apt command failed (attempt ${i}/${max}), retrying..."
    sleep 5
  done
  return 1
}

retry_apt apt-get update -y
retry_apt apt-get install -y curl git ca-certificates gnupg build-essential python3 openssl postgresql postgresql-contrib whiptail cron
if is_true "${APT_UPGRADE}"; then
  apt-get upgrade -y
else
  log "Skipping apt-get upgrade (APT_UPGRADE=${APT_UPGRADE})"
fi

# ── Node.js ──────────────────────────────────────────────────────────────────
step "Ensuring Node.js"
NEED_NODE_INSTALL="false"
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE_INSTALL="true"
else
  CURRENT_NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if (( CURRENT_NODE_MAJOR < NODE_MAJOR )); then
    NEED_NODE_INSTALL="true"
  fi
fi

if [[ "${NEED_NODE_INSTALL}" == "true" ]]; then
  log "Installing Node.js ${NODE_MAJOR}.x from NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi
command -v node >/dev/null 2>&1 || die "Node.js installation failed."
command -v npm >/dev/null 2>&1 || die "npm installation failed."
log "Using Node.js $(node -v), npm $(npm -v)"

# ── pnpm ─────────────────────────────────────────────────────────────────────
step "Preparing pnpm (${PNPM_VERSION})"
cleanup_pnpm_bins true
npm install -g "pnpm@${PNPM_VERSION}" --force
hash -r
command -v pnpm >/dev/null 2>&1 || die "pnpm installation failed."
PNPM_BIN="$(command -v pnpm)"
log "Using pnpm version: $(pnpm --version) (${PNPM_BIN})"

# ── Application source ───────────────────────────────────────────────────────
step "Preparing application source"
cd /
mkdir -p "$(dirname "${APP_DIR}")"

if [[ -d "${APP_DIR}/.git" ]]; then
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  if is_true "${CLEAN_INSTALL}"; then
    log "CLEAN_INSTALL=true -> removing existing directory ${APP_DIR}"
    rm -rf "${APP_DIR}"
  else
    # On updates: allow local changes (user may have made config edits)
    if [[ "${IS_UPDATE}" == "false" ]]; then
      if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --quiet --ignore-submodules --; then
        die "Local changes detected in ${APP_DIR}. Commit/stash them or run with CLEAN_INSTALL=true."
      fi
      if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --cached --quiet --ignore-submodules --; then
        die "Staged local changes detected in ${APP_DIR}. Commit/stash them or run with CLEAN_INSTALL=true."
      fi
    fi
    log "Repository exists, updating to ${BRANCH}..."
    sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all --prune
    sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${BRANCH}" || true
    sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}" || {
      warn "Fast-forward pull failed. Attempting merge..."
      sudo -u "${APP_USER}" git -C "${APP_DIR}" pull origin "${BRANCH}"
    }
  fi
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  log "Cloning repository..."
  CLONE_TMP="$(mktemp -d /tmp/HTMLSignage-clone-XXXXXX)"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${CLONE_TMP}"
  rm -rf "${APP_DIR}"
  mv "${CLONE_TMP}" "${APP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
fi

# ── Node dependencies ────────────────────────────────────────────────────────
step "Installing Node dependencies"
if [[ "${IS_UPDATE}" == "true" ]]; then
  sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; cd '${APP_DIR}'; pnpm install --frozen-lockfile --ignore-scripts=false"
else
  sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; cd '${APP_DIR}'; pnpm install --frozen-lockfile --ignore-scripts=false"
fi

# ── PostgreSQL ───────────────────────────────────────────────────────────────
step "Configuring PostgreSQL"
systemctl enable --now postgresql

# Harden PostgreSQL: restrict to localhost only
PG_VERSION="$(sudo -u postgres psql -tAc "SHOW server_version;" | cut -d. -f1)"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

if [[ -f "${PG_CONF}" ]]; then
  sed -i "s/^#*listen_addresses.*/listen_addresses = 'localhost'/" "${PG_CONF}"
  log "PostgreSQL restricted to localhost connections only"
fi

if [[ -f "${PG_HBA}" ]]; then
  # Ensure local connections use md5 (password) authentication
  if grep -q "^local.*all.*all.*peer" "${PG_HBA}" 2>/dev/null; then
    sed -i "s/^local.*all.*all.*peer/local   all             all                                     md5/" "${PG_HBA}"
    log "PostgreSQL authentication set to md5 for local connections"
  fi
  systemctl reload postgresql
fi

if [[ "${IS_UPDATE}" == "false" ]]; then
  # Fresh install: provision database
  if [[ -z "${DB_PASS}" ]]; then
    DB_PASS="$(openssl rand -hex 18)"
  fi

  DB_PASS_SQL="${DB_PASS//\'/\'\'}"
  sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS_SQL}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS_SQL}';
  END IF;
END
\$\$;
SQL

  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  fi
  sudo -u postgres psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
else
  log "Update-Modus: PostgreSQL-Konfiguration wird beibehalten."
fi

# ── Environment files ────────────────────────────────────────────────────────
step "Writing environment files"

if [[ "${IS_UPDATE}" == "false" ]]; then
  # Fresh install: write new .env files
  DB_PASS_URL_ENCODED="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "${DB_PASS}")"
  cat > "${BACKEND_ENV}" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS_URL_ENCODED}@localhost:5432/${DB_NAME}?schema=public"
PORT=${BACKEND_PORT}
NODE_ENV=production
FRONTEND_URL="${FRONTEND_URL}"
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
RESET_PASSWORD_URL_BASE="${RESET_PASSWORD_URL_BASE}"
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_SECURE=${SMTP_SECURE}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
MAIL_FROM="${MAIL_FROM}"
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760
SESSION_DURATION=604800
EOF
  chown "${APP_USER}:${APP_USER}" "${BACKEND_ENV}"
  chmod 600 "${BACKEND_ENV}"

  cat > "${FRONTEND_ENV}" <<EOF
VITE_API_URL=${VITE_API_URL}
EOF
  chown "${APP_USER}:${APP_USER}" "${FRONTEND_ENV}"
else
  log "Update-Modus: .env-Dateien bleiben unveraendert."
  [[ -f "${BACKEND_ENV}" ]] || die "Backend .env nicht gefunden: ${BACKEND_ENV}"
  [[ -f "${FRONTEND_ENV}" ]] || die "Frontend .env nicht gefunden: ${FRONTEND_ENV}"

  # Extract DB_PASS from existing DATABASE_URL for potential future use
  EXISTING_DB_URL="$(grep -oP '^DATABASE_URL="\K[^"]+' "${BACKEND_ENV}" 2>/dev/null || true)"
  if [[ -n "${EXISTING_DB_URL}" ]]; then
    DB_PASS="$(echo "${EXISTING_DB_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p' | node -e "console.log(decodeURIComponent(require('fs').readFileSync('/dev/stdin','utf8').trim()))" 2>/dev/null || true)"
  fi
fi

# ── Directory setup ──────────────────────────────────────────────────────────
step "Creating application directories"

# Upload directory
UPLOAD_DIR="${APP_DIR}/packages/backend/uploads"
mkdir -p "${UPLOAD_DIR}"
chown "${APP_USER}:${APP_USER}" "${UPLOAD_DIR}"
chmod 750 "${UPLOAD_DIR}"
log "Upload directory created: ${UPLOAD_DIR}"

# Logs directory
LOGS_DIR="${APP_DIR}/logs"
mkdir -p "${LOGS_DIR}"
chown "${APP_USER}:${APP_USER}" "${LOGS_DIR}"
chmod 750 "${LOGS_DIR}"
log "Logs directory created: ${LOGS_DIR}"

# Backup directory
BACKUP_DIR="${APP_DIR}/backups"
mkdir -p "${BACKUP_DIR}"
chown "${APP_USER}:${APP_USER}" "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"
log "Backup directory created: ${BACKUP_DIR}"

# ── Prisma migrations ────────────────────────────────────────────────────────
step "Running Prisma migrations"
sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; cd '${APP_DIR}/packages/backend'; pnpm exec prisma generate; pnpm exec prisma migrate deploy"
sudo -u "${APP_USER}" env APP_DIR="${APP_DIR}" bash <<'BASH'
set -Eeuo pipefail
cd "${APP_DIR}/packages/backend"
node --env-file=./.env --input-type=module <<'NODE'
const requiredTables = [
  'users',
  'sessions',
  'password_reset_tokens',
  'devices',
  'device_overrides',
  'schedules',
  'settings',
  'media',
  'custom_palettes',
  'audit_logs',
  'system_jobs',
  'runtime_history',
  'rate_limits',
];

const { Client } = await import('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
const result = await client.query(
  `SELECT table_name
     FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])`,
  [requiredTables],
);
await client.end();

const existing = new Set(result.rows.map((row) => row.table_name));
const missing = requiredTables.filter((table) => !existing.has(table));

if (missing.length > 0) {
  console.error(`Missing required database tables: ${missing.join(', ')}`);
  process.exit(1);
}
NODE
BASH

# ── Build ────────────────────────────────────────────────────────────────────
step "Checking system resources"
TOTAL_MEM_KB="$(grep MemTotal /proc/meminfo | awk '{print $2}')"
TOTAL_MEM_MB="$((TOTAL_MEM_KB / 1024))"
if [[ "${TOTAL_MEM_MB}" -lt 2048 ]]; then
  warn "Low memory detected (${TOTAL_MEM_MB}MB). Build may fail."
  if ! swapon --show 2>/dev/null | grep -q .; then
    warn "No swap found. Creating 2GB swap file..."
    fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    log "Swap file created and activated"
  fi
fi

step "Building frontend and backend"
sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; cd '${APP_DIR}'; pnpm build"

# ── Systemd services ─────────────────────────────────────────────────────────
step "Creating systemd service files"

cat > /etc/systemd/system/htmlsignage-backend.service <<EOF
[Unit]
Description=HTMLSignage Backend API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${PNPM_BIN} --filter backend start
Restart=always
RestartSec=5

# Security hardening
ProtectSystem=strict
ProtectHome=read-only
NoNewPrivileges=yes
PrivateTmp=yes
ReadWritePaths=${APP_DIR}/packages/backend/uploads ${APP_DIR}/logs ${APP_DIR}/backups
ReadOnlyPaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/htmlsignage-frontend.service <<EOF
[Unit]
Description=HTMLSignage Frontend
After=network.target htmlsignage-backend.service
Wants=htmlsignage-backend.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/packages/frontend
Environment=NODE_ENV=production
Environment=PORT=${FRONTEND_PORT}
Environment=HOST=0.0.0.0
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/usr/bin/node serve.mjs
Restart=always
RestartSec=5

# Security hardening
ProtectSystem=strict
ProtectHome=read-only
NoNewPrivileges=yes
PrivateTmp=yes
ReadWritePaths=${APP_DIR}/packages/frontend/logs
ReadOnlyPaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF

step "Reloading and starting services"

# Stop any existing services and free ports before starting fresh
log "Stopping existing HTMLSignage services..."
systemctl stop htmlsignage-backend.service 2>/dev/null || true
systemctl stop htmlsignage-frontend.service 2>/dev/null || true

# Kill any stray processes still holding the ports
for port in "${BACKEND_PORT}" "${FRONTEND_PORT}"; do
  pids="$(fuser -k ${port}/tcp 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    log "Killed processes holding port ${port}"
    sleep 1
  fi
done

systemctl daemon-reload
systemctl enable --now htmlsignage-backend.service
systemctl enable --now htmlsignage-frontend.service

# ── Firewall ─────────────────────────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Opening firewall ports ${FRONTEND_PORT} and ${BACKEND_PORT}..."
  ufw allow "${FRONTEND_PORT}/tcp" || true
  ufw allow "${BACKEND_PORT}/tcp" || true
fi

# ── Log rotation ─────────────────────────────────────────────────────────────
step "Configuring log rotation"
cat > /etc/logrotate.d/htmlsignage <<'LOGROTATE'
/opt/HTMLSignage/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${APP_USER} ${APP_USER}
    sharedscripts
    postrotate
        systemctl reload htmlsignage-backend 2>/dev/null || true
    endscript
}
LOGROTATE
# Replace placeholder with actual user
sed -i "s/\${APP_USER}/${APP_USER}/g" /etc/logrotate.d/htmlsignage
log "Log rotation configured for ${APP_USER}"

# ── Disk cleanup cron ────────────────────────────────────────────────────────
step "Installing disk cleanup cron job"
CLEANUP_SRC="${APP_DIR}/scripts/disk-cleanup.sh"
CLEANUP_DST="/usr/local/bin/htmlsignage-disk-cleanup.sh"
if [[ -f "${CLEANUP_SRC}" ]]; then
  cp "${CLEANUP_SRC}" "${CLEANUP_DST}"
  chmod +x "${CLEANUP_DST}"
  EXISTING_CRON="$(crontab -u "${APP_USER}" -l 2>/dev/null || true)"
  if ! echo "${EXISTING_CRON}" | grep -q "htmlsignage-disk-cleanup"; then
    echo "${EXISTING_CRON}" | { cat; echo "0 */6 * * * ${CLEANUP_DST} >/dev/null 2>&1"; } | crontab -u "${APP_USER}" -
    log "Disk cleanup cron installed (runs every 6 hours as ${APP_USER})"
  else
    log "Disk cleanup cron already installed"
  fi
else
  warn "disk-cleanup.sh not found at ${CLEANUP_SRC}, skipping cron setup"
fi

# ── Backup script ────────────────────────────────────────────────────────────
step "Installing backup script"
BACKUP_SCRIPT="/usr/local/bin/htmlsignage-backup.sh"
cat > "${BACKUP_SCRIPT}" <<'BACKUP_SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/HTMLSignage}"
BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Extract DB credentials from .env
BACKEND_ENV="${APP_DIR}/packages/backend/.env"
if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "Error: ${BACKEND_ENV} not found" >&2
  exit 1
fi

DB_URL="$(grep -oP '^DATABASE_URL="\K[^"]+' "${BACKEND_ENV}")"
DB_NAME="$(echo "${DB_URL}" | sed -n 's|.*/\([^?]*\).*|\1|p')"
DB_USER="$(echo "${DB_URL}" | sed -n 's|.*://\([^:]*\):.*|\1|p')"
DB_PASS_ENCODED="$(echo "${DB_URL}" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
DB_HOST="$(echo "${DB_URL}" | sed -n 's|.*@\([^:]*\):.*|\1|p')"
DB_PORT="$(echo "${DB_URL}" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')"
DB_PASS="$(node -e "console.log(decodeURIComponent(process.argv[1] || ''))" "${DB_PASS_ENCODED}")"

log "Starting backup of database '${DB_NAME}'"

# Database backup
PGPASSWORD="${DB_PASS}" pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -Fc "${DB_NAME}" > "${BACKUP_DIR}/db_${TIMESTAMP}.dump"
log "Database backup: db_${TIMESTAMP}.dump ($(du -h "${BACKUP_DIR}/db_${TIMESTAMP}.dump" | cut -f1))"

# Uploads backup
if [[ -d "${APP_DIR}/packages/backend/uploads" ]]; then
  tar -czf "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "${APP_DIR}/packages/backend" uploads/
  log "Uploads backup: uploads_${TIMESTAMP}.tar.gz ($(du -h "${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz" | cut -f1))"
fi

# .env backup (secrets)
cp "${BACKEND_ENV}" "${BACKUP_DIR}/env_${TIMESTAMP}.bak"
chmod 600 "${BACKUP_DIR}/env_${TIMESTAMP}.bak"
log "Environment backup saved"

# Clean old backups
find "${BACKUP_DIR}" -mtime +${RETENTION_DAYS} -delete
log "Cleaned backups older than ${RETENTION_DAYS} days"

log "Backup completed successfully"
BACKUP_SCRIPT

chmod +x "${BACKUP_SCRIPT}"
chown "${APP_USER}:${APP_USER}" "${BACKUP_SCRIPT}"

# Install backup cron (daily at 3am)
EXISTING_CRON="$(crontab -u "${APP_USER}" -l 2>/dev/null || true)"
if ! echo "${EXISTING_CRON}" | grep -q "htmlsignage-backup"; then
  echo "${EXISTING_CRON}" | { cat; echo "0 3 * * * ${BACKUP_SCRIPT} >> ${APP_DIR}/logs/backup.log 2>&1"; } | crontab -u "${APP_USER}" -
  log "Backup cron installed (daily at 3am)"
else
  log "Backup cron already installed"
fi

# ── Health checks ────────────────────────────────────────────────────────────
if ! is_true "${SKIP_HEALTHCHECKS:-false}"; then
  step "Health checks"

  # Database connectivity check
  log "Checking database connectivity..."
  if sudo -u postgres psql -d "${DB_NAME}" -c "SELECT 1" >/dev/null 2>&1; then
    log "Database '${DB_NAME}' is reachable"
  else
    warn "Database connectivity check failed"
  fi

  if ! wait_for_url "Backend health" "http://127.0.0.1:${BACKEND_PORT}/health" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"; then
    warn "Backend health check failed. Diagnostics:"
    systemctl --no-pager --full status htmlsignage-backend.service || true
    journalctl -u htmlsignage-backend.service -n 80 --no-pager || true
    die "Backend health check failed after ${HEALTHCHECK_RETRIES} retries."
  fi
  if ! wait_for_url "Frontend health" "http://127.0.0.1:${FRONTEND_PORT}/health" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"; then
    warn "Frontend health check failed. Diagnostics:"
    systemctl --no-pager --full status htmlsignage-frontend.service || true
    journalctl -u htmlsignage-frontend.service -n 80 --no-pager || true
    die "Frontend health check failed after ${HEALTHCHECK_RETRIES} retries."
  fi
else
  log "Skipping health checks (SKIP_HEALTHCHECKS=${SKIP_HEALTHCHECKS})"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
ACCESS_HOST="$(hostname -I 2>/dev/null | awk '{print $1}')"
[[ -z "${ACCESS_HOST}" ]] && ACCESS_HOST="$(hostname)"

SUMMARY="Installation abgeschlossen!

Frontend: http://${ACCESS_HOST}:${FRONTEND_PORT}
Display:  http://${ACCESS_HOST}:${FRONTEND_PORT}/display
Backend:  http://${ACCESS_HOST}:${BACKEND_PORT}/health

Systemd:
  systemctl status htmlsignage-backend
  systemctl status htmlsignage-frontend

Log: ${INSTALL_LOG}
Konfiguration: ${BACKEND_ENV}"

if [[ "${IS_UPDATE}" == "false" ]]; then
  SUMMARY="${SUMMARY}

Erster Admin-User:
  Frontend oeffnen und ersten Account registrieren (wird automatisch Admin)."
fi

if [[ "${HAS_WHIPTAIL}" == "true" ]]; then
  show_info "Installation abgeschlossen" "${SUMMARY}"
fi

echo
echo "${SUMMARY}"
