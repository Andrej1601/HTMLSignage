#!/usr/bin/env bash
set -euo pipefail

# HTMLSignage v2 bootstrap for a fresh Ubuntu/Debian machine.
# Installs runtime dependencies, deploys repo, provisions Postgres,
# builds the app and configures systemd services for backend/frontend.

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash scripts/install-new-machine.sh"
  exit 1
fi

log() { echo "[install] $*"; }
die() { echo "[install][error] $*" >&2; exit 1; }

REPO_URL="${REPO_URL:-https://github.com/Andrej1601/HTMLSignage.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/HTMLSignage}"
APP_USER="${APP_USER:-${SUDO_USER:-andrej}}"
DB_NAME="${DB_NAME:-htmlsignage}"
DB_USER="${DB_USER:-signage}"
DB_PASS="${DB_PASS:-$(openssl rand -hex 18)}"
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
NODE_MAJOR="${NODE_MAJOR:-20}"
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  die "User '${APP_USER}' does not exist. Create the user first or pass APP_USER=<existing-user>."
fi

JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"

log "Configuration:"
log "APP_DIR=${APP_DIR}"
log "APP_USER=${APP_USER}"
log "PORTS frontend=${FRONTEND_PORT} backend=${BACKEND_PORT}"
log "DATABASE ${DB_USER}@${DB_NAME}"
log "FRONTEND_URL=${FRONTEND_URL}"
log "NODE_MAJOR=${NODE_MAJOR}"
log "PNPM_VERSION=${PNPM_VERSION}"

if [[ -z "${RESET_PASSWORD_URL_BASE}" && "${FRONTEND_URL}" != "*" ]]; then
  RESET_PASSWORD_URL_BASE="${FRONTEND_URL}"
fi

log "Installing base packages..."
apt-get update -y
apt-get install -y curl git ca-certificates gnupg build-essential postgresql postgresql-contrib
apt-get upgrade -y

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
else
  log "Using existing Node.js: $(node -v)"
fi

log "Preparing pnpm (${PNPM_VERSION})..."
CURRENT_PNPM="$(pnpm --version 2>/dev/null || true)"
if [[ "${CURRENT_PNPM}" == "${PNPM_VERSION}" ]]; then
  log "pnpm already available: ${CURRENT_PNPM}"
elif command -v corepack >/dev/null 2>&1; then
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
else
  log "corepack not found, installing pnpm via npm..."
  for bin in /usr/bin/pnpm /usr/bin/pnpx /usr/local/bin/pnpm /usr/local/bin/pnpx; do
    if [[ -L "${bin}" && ! -e "${bin}" ]]; then
      log "Removing broken symlink ${bin}..."
      rm -f "${bin}"
    fi
  done

  if ! npm install -g "pnpm@${PNPM_VERSION}"; then
    log "Initial pnpm install failed, removing conflicting pnpm/pnpx paths and retrying..."
    rm -f /usr/bin/pnpm /usr/bin/pnpx /usr/local/bin/pnpm /usr/local/bin/pnpx
    npm install -g "pnpm@${PNPM_VERSION}"
  fi
fi
hash -r
log "Using pnpm version: $(pnpm --version)"

log "Ensuring application directory..."
mkdir -p "$(dirname "${APP_DIR}")"
if [[ -d "${APP_DIR}/.git" ]]; then
  log "Repository exists, updating to ${BRANCH}..."
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" fetch origin
  sudo -u "${APP_USER}" git -C "${APP_DIR}" checkout "${BRANCH}"
  sudo -u "${APP_USER}" git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  log "Cloning repository..."
  rm -rf "${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
fi

log "Installing Node dependencies (forced to build native modules)..."
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && pnpm install --force --no-frozen-lockfile --ignore-scripts=false"

log "Configuring PostgreSQL..."
systemctl enable --now postgresql
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi
sudo -u postgres psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

log "Writing backend environment..."
cat > "${APP_DIR}/packages/backend/.env" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"
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

log "Writing frontend production environment..."
cat > "${APP_DIR}/packages/frontend/.env.production" <<EOF
VITE_API_URL=${VITE_API_URL}
EOF
chown "${APP_USER}:${APP_USER}" "${APP_DIR}/packages/frontend/.env.production"

log "Running Prisma migrations and generate..."
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}/packages/backend' && npx prisma generate && npx prisma migrate deploy"

log "Building frontend/backend..."
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npx pnpm build"

log "Creating systemd service files..."
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
ExecStart=/usr/bin/env npx pnpm --filter backend start
Restart=always
RestartSec=5

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
ExecStart=/usr/bin/env npx pnpm --filter frontend preview --host 0.0.0.0 --port ${FRONTEND_PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

log "Reloading and starting services..."
systemctl daemon-reload
systemctl enable --now htmlsignage-backend.service
systemctl enable --now htmlsignage-frontend.service

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  log "Opening firewall ports ${FRONTEND_PORT} and ${BACKEND_PORT}..."
  ufw allow "${FRONTEND_PORT}/tcp" || true
  ufw allow "${BACKEND_PORT}/tcp" || true
fi

log "Health checks..."
sleep 2
curl -fsS "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null
curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null

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

DB credentials were written to:
  ${APP_DIR}/packages/backend/.env

First admin user:
  Open frontend and register first account (first user becomes admin).
EOF
