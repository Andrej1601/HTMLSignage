#!/usr/bin/env bash
set -Eeuo pipefail

# HTMLSignage v2 bootstrap for a fresh Ubuntu/Debian machine.
# Installs runtime dependencies, deploys repo, provisions Postgres,
# builds the app and configures systemd services for backend/frontend.

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash scripts/install-new-machine.sh"
  exit 1
fi

log() { echo "[install] $*"; }
warn() { echo "[install][warn] $*" >&2; }
die() { echo "[install][error] $*" >&2; exit 1; }
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
  local label="$1"
  local url="$2"
  local retries="$3"
  local delay="$4"
  local i
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
  local remove_all="${1:-false}"
  local bin
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

REPO_URL="${REPO_URL:-https://github.com/Andrej1601/HTMLSignage.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/HTMLSignage}"
APP_USER="${APP_USER:-${SUDO_USER:-andrej}}"
DB_NAME="${DB_NAME:-htmlsignage}"
DB_USER="${DB_USER:-signage}"
DB_PASS="${DB_PASS:-}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_URL="${FRONTEND_URL:-*}"
VITE_API_URL="${VITE_API_URL:-}"
RESET_PASSWORD_URL_BASE="${RESET_PASSWORD_URL_BASE:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SECURE="${SMTP_SECURE:-false}"
SMTP_USER="${SMTP_USER:-}"
SMTP_PASS="${SMTP_PASS:-}"
MAIL_FROM="${MAIL_FROM:-}"
JWT_SECRET="${JWT_SECRET:-}"
NODE_MAJOR="${NODE_MAJOR:-20}"
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"
CLEAN_INSTALL="${CLEAN_INSTALL:-false}"
APT_UPGRADE="${APT_UPGRADE:-false}"
SKIP_HEALTHCHECKS="${SKIP_HEALTHCHECKS:-false}"
HEALTHCHECK_RETRIES="${HEALTHCHECK_RETRIES:-45}"
HEALTHCHECK_DELAY="${HEALTHCHECK_DELAY:-2}"

mkdir -p "$(dirname "${INSTALL_LOG}")"
touch "${INSTALL_LOG}"
chmod 600 "${INSTALL_LOG}" || true
exec > >(tee -a "${INSTALL_LOG}") 2>&1

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

if [[ -z "${RESET_PASSWORD_URL_BASE}" && "${FRONTEND_URL}" != "*" ]]; then
  RESET_PASSWORD_URL_BASE="${FRONTEND_URL}"
fi

step "Configuration"
log "APP_DIR=${APP_DIR}"
log "APP_USER=${APP_USER}"
log "REPO=${REPO_URL} (${BRANCH})"
log "PORTS frontend=${FRONTEND_PORT} backend=${BACKEND_PORT}"
log "DATABASE ${DB_USER}@${DB_NAME}"
log "FRONTEND_URL=${FRONTEND_URL}"
log "NODE_MAJOR=${NODE_MAJOR}"
log "PNPM_VERSION=${PNPM_VERSION}"
log "CLEAN_INSTALL=${CLEAN_INSTALL}"
log "APT_UPGRADE=${APT_UPGRADE}"
log "SKIP_HEALTHCHECKS=${SKIP_HEALTHCHECKS}"
log "INSTALL_LOG=${INSTALL_LOG}"

step "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg build-essential openssl postgresql postgresql-contrib
if is_true "${APT_UPGRADE}"; then
  apt-get upgrade -y
else
  log "Skipping apt-get upgrade (APT_UPGRADE=${APT_UPGRADE})"
fi

if [[ -z "${DB_PASS}" ]]; then
  DB_PASS="$(openssl rand -hex 18)"
fi
if [[ -z "${JWT_SECRET}" ]]; then
  JWT_SECRET="$(openssl rand -hex 32)"
fi

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

step "Preparing pnpm (${PNPM_VERSION})"
cleanup_pnpm_bins
CURRENT_PNPM="$(pnpm --version 2>/dev/null || true)"
if [[ "${CURRENT_PNPM}" != "${PNPM_VERSION}" ]]; then
  if command -v corepack >/dev/null 2>&1; then
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    corepack enable
    if ! corepack prepare "pnpm@${PNPM_VERSION}" --activate; then
      warn "corepack prepare failed, falling back to npm global install."
      cleanup_pnpm_bins true
      npm install -g "pnpm@${PNPM_VERSION}" --force
    fi
  else
    warn "corepack not found, installing pnpm via npm..."
    cleanup_pnpm_bins true
    npm install -g "pnpm@${PNPM_VERSION}" --force
  fi
fi

hash -r
command -v pnpm >/dev/null 2>&1 || die "pnpm installation failed."
PNPM_BIN="$(command -v pnpm)"
log "Using pnpm version: $(pnpm --version) (${PNPM_BIN})"

step "Preparing application source"
cd /
mkdir -p "$(dirname "${APP_DIR}")"

if [[ -d "${APP_DIR}/.git" ]]; then
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  if is_true "${CLEAN_INSTALL}"; then
    log "CLEAN_INSTALL=true -> removing existing directory ${APP_DIR}"
    rm -rf "${APP_DIR}"
  else
    if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --quiet --ignore-submodules --; then
      die "Local changes detected in ${APP_DIR}. Commit/stash them or run with CLEAN_INSTALL=true."
    fi
    if ! sudo -u "${APP_USER}" git -C "${APP_DIR}" diff --cached --quiet --ignore-submodules --; then
      die "Staged local changes detected in ${APP_DIR}. Commit/stash them or run with CLEAN_INSTALL=true."
    fi
    log "Repository exists, updating to ${BRANCH}..."
    sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch --all --prune
    sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${BRANCH}"
    sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
  fi
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  log "Cloning repository..."
  rm -rf "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
fi

step "Installing Node dependencies"
sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; cd '${APP_DIR}'; pnpm install --force --no-frozen-lockfile --ignore-scripts=false"

step "Configuring PostgreSQL"
systemctl enable --now postgresql
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

step "Writing environment files"
DB_PASS_URL_ENCODED="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "${DB_PASS}")"
cat > "${APP_DIR}/packages/backend/.env" <<EOF
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
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/packages/backend/.env"
chmod 600 "${APP_DIR}/packages/backend/.env"

cat > "${APP_DIR}/packages/frontend/.env.production" <<EOF
VITE_API_URL=${VITE_API_URL}
EOF
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/packages/frontend/.env.production"

step "Running Prisma migrations (Prisma 7)"
sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; cd '${APP_DIR}/packages/backend'; pnpm exec prisma generate; pnpm exec prisma migrate deploy"

step "Building frontend and backend"
sudo -u "${APP_USER}" bash -lc "set -Eeuo pipefail; cd '${APP_DIR}'; pnpm build"

step "Creating systemd service files"
cat > /etc/systemd/system/htmlsignage-backend.service <<EOF
[Unit]
Description=HTMLSignage Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${PNPM_BIN} --filter backend start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/htmlsignage-frontend.service <<EOF
[Unit]
Description=HTMLSignage Frontend (Vite preview)
After=network.target htmlsignage-backend.service
Wants=htmlsignage-backend.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${PNPM_BIN} --filter frontend preview --host 0.0.0.0 --port ${FRONTEND_PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

step "Reloading and starting services"
systemctl daemon-reload
systemctl enable --now htmlsignage-backend.service
systemctl enable --now htmlsignage-frontend.service

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Opening firewall ports ${FRONTEND_PORT} and ${BACKEND_PORT}..."
  ufw allow "${FRONTEND_PORT}/tcp" || true
  ufw allow "${BACKEND_PORT}/tcp" || true
fi

if ! is_true "${SKIP_HEALTHCHECKS}"; then
  step "Health checks"
  if ! wait_for_url "Backend health" "http://127.0.0.1:${BACKEND_PORT}/health" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"; then
    systemctl --no-pager --full status htmlsignage-backend.service || true
    journalctl -u htmlsignage-backend.service -n 80 --no-pager || true
    die "Backend health check failed."
  fi
  if ! wait_for_url "Frontend health" "http://127.0.0.1:${FRONTEND_PORT}/" "${HEALTHCHECK_RETRIES}" "${HEALTHCHECK_DELAY}"; then
    systemctl --no-pager --full status htmlsignage-frontend.service || true
    journalctl -u htmlsignage-frontend.service -n 80 --no-pager || true
    die "Frontend health check failed."
  fi
else
  log "Skipping health checks (SKIP_HEALTHCHECKS=${SKIP_HEALTHCHECKS})"
fi

ACCESS_HOST="$(hostname -I | awk '{print $1}')"
if [[ -z "${ACCESS_HOST}" ]]; then
  ACCESS_HOST="$(hostname)"
fi

cat <<EOF

Install complete.

Frontend: http://${ACCESS_HOST}:${FRONTEND_PORT}
Display:  http://${ACCESS_HOST}:${FRONTEND_PORT}/display
Backend:  http://${ACCESS_HOST}:${BACKEND_PORT}/health

Systemd status:
  systemctl status htmlsignage-backend.service
  systemctl status htmlsignage-frontend.service

Installer log:
  ${INSTALL_LOG}

DB credentials were written to:
  ${APP_DIR}/packages/backend/.env

First admin user:
  Open frontend and register first account (first user becomes admin).
EOF
