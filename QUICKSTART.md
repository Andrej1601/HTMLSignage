# Quick Start Guide

## 1. Fresh Ubuntu Machine

Run these commands on a clean Ubuntu/Debian host:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates

git clone https://github.com/Andrej1601/HTMLSignage.git /opt/HTMLSignage
cd /opt/HTMLSignage

sudo APP_USER="$USER" bash scripts/install-new-machine.sh
```

After install:

```bash
systemctl status htmlsignage-backend.service --no-pager
systemctl status htmlsignage-frontend.service --no-pager
ss -tulpen | grep -E ':(3000|5173)\b'
curl http://127.0.0.1:3000/health
```

URLs:
- Admin: `http://<machine-ip-or-hostname>:5173`
- Display: `http://<machine-ip-or-hostname>:5173/display`
- API health: `http://<machine-ip-or-hostname>:3000/health`

The first user registration becomes admin.

## 2. Optional Installer Overrides

You can override defaults when needed:

```bash
sudo \
  APP_USER="$USER" \
  APP_DIR="/opt/HTMLSignage" \
  DB_NAME="htmlsignage" \
  DB_USER="signage" \
  DB_PASS="strong-db-password" \
  FRONTEND_URL="*" \
  VITE_API_URL="" \
  BACKEND_PORT="3000" \
  FRONTEND_PORT="5173" \
  JWT_SECRET="strong-jwt-secret" \
  bash scripts/install-new-machine.sh
```

## 3. Update an Existing Installation

```bash
cd /opt/HTMLSignage
git pull --ff-only origin main
sudo systemctl restart htmlsignage-backend.service
sudo systemctl restart htmlsignage-frontend.service
```

## 4. Local Development (manual)

```bash
cd /path/to/HTMLSignage
npx pnpm install
cp packages/backend/.env.example packages/backend/.env
npx pnpm --filter backend db:generate
npx pnpm --filter backend db:migrate
npx pnpm dev
```

Local URLs:
- Frontend: `http://localhost:5173`
- Display: `http://localhost:5173/display`
- Backend: `http://localhost:3000`

## 5. Troubleshooting

- Backend logs: `journalctl -u htmlsignage-backend.service -f`
- Frontend logs: `journalctl -u htmlsignage-frontend.service -f`
- Restart both: `sudo systemctl restart htmlsignage-backend htmlsignage-frontend`
