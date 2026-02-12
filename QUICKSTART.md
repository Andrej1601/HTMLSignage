# Quick Start Guide

## 🚀 Get Up and Running in 5 Minutes

### Step 1: Install Dependencies

```bash
cd /home/andrej/HTMLSignage

# Install pnpm globally (if not already installed)
npm install -g pnpm

# Install all dependencies
pnpm install
```

### Step 2: Setup PostgreSQL

**Option A: Local PostgreSQL**
```bash
sudo -u postgres psql
CREATE DATABASE htmlsignage;
CREATE USER signage WITH PASSWORD 'signage123';
GRANT ALL PRIVILEGES ON DATABASE htmlsignage TO signage;
\q
```

**Option B: Docker (Recommended)**
```bash
docker run -d \
  --name htmlsignage-db \
  -e POSTGRES_DB=htmlsignage \
  -e POSTGRES_USER=signage \
  -e POSTGRES_PASSWORD=signage123 \
  -p 5432:5432 \
  postgres:16
```

### Step 3: Configure Environment

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env`:
```env
DATABASE_URL="postgresql://signage:signage123@localhost:5432/htmlsignage"
JWT_SECRET="change-me-in-production"
FRONTEND_URL="http://localhost:5173"
PORT=3000
```

### Step 4: Initialize Database

```bash
# Generate Prisma Client
pnpm --filter backend db:generate

# Run migrations
pnpm --filter backend db:migrate
```

### Step 5: Start Development Servers

```bash
# Start both backend and frontend
pnpm dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Health Check: http://localhost:3000/health

## 🔍 Verify Everything Works

```bash
# Test backend health
curl http://localhost:3000/health

# Test schedule API
curl http://localhost:3000/api/schedule

# Open Prisma Studio (database GUI)
pnpm db:studio
```

## 🛠️ Next Steps

1. **Implement Authentication** - Complete auth middleware
2. **Build Schedule Editor** - Migrate grid component to React
3. **Add Settings UI** - Design/theme editor
4. **Implement Media Upload** - File upload with multer
5. **Data Migration** - Migrate from SQLite to PostgreSQL
6. **Deploy to Production** - Nginx + PM2/Systemd

## 📚 Useful Commands

```bash
# Backend only
pnpm backend

# Frontend only
pnpm frontend

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build

# Database management
pnpm db:studio      # Open Prisma Studio
pnpm db:generate    # Regenerate Prisma Client
pnpm db:push        # Push schema without migration
```

## 🐛 Troubleshooting

### Can't connect to PostgreSQL
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or for Docker
docker ps | grep htmlsignage-db
```

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Prisma Client not generated
```bash
pnpm --filter backend db:generate
```

## 💡 Development Tips

- Use **React DevTools** browser extension for debugging
- Use **Prisma Studio** for database inspection
- Enable **React Query DevTools** in development
- Check browser console for WebSocket connection
- Backend logs are in console (no file logging yet)

Happy coding! 🎉
