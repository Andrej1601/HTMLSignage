# HTMLSignage v2.0 - Modern Digital Signage System

Complete rewrite with modern TypeScript stack for Westfalenbad Hagen Sauna facility.

## 🎯 Features

### ✅ Admin Interface
- **Dashboard** - System overview with statistics and quick actions
- **Schedule Editor** - Visual weekly sauna infusion plan editor
- **Device Management** - Register, monitor, and control displays
- **Media Library** - Upload and manage images, audio, and video files
- **Settings Editor** - Configure themes, fonts, and audio
- **Real-time Updates** - WebSocket-based live synchronization

### ✅ Display Client
- **Slideshow System** - Automatic rotation between overview and clock
- **Overview Slide** - Full weekly schedule display
- **Clock Slide** - Large digital clock with date
- **Auto-Update** - Receives schedule/settings changes instantly
- **Heartbeat System** - Reports online status to admin

### ✅ System Features
- **Monorepo Architecture** - Backend and frontend in one workspace
- **Type Safety** - Full TypeScript coverage
- **Modern UI** - Tailwind CSS with Wellness/Spa theme
- **Responsive Design** - Works on all screen sizes
- **LAN Access** - Optimized for local network deployment

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16+ with Prisma ORM
- **Validation**: Zod
- **Real-time**: Socket.IO
- **File Upload**: Multer
- **Security**: Helmet, bcrypt, JWT, CORS

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (Custom Wellness/Spa theme)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios

### Database
- **PostgreSQL** with 8 models:
  - User (authentication)
  - Session (JWT sessions)
  - Device (display management)
  - DeviceOverride (device-specific configs)
  - Schedule (weekly sauna plan)
  - Settings (theme & design)
  - Media (file library)
  - AuditLog (activity tracking)

## 📂 Project Structure

```
HTMLSignage/
├── packages/
│   ├── backend/                    # Express + Prisma API
│   │   ├── src/
│   │   │   ├── routes/            # API endpoints
│   │   │   │   ├── schedule.ts    # Schedule CRUD
│   │   │   │   ├── settings.ts    # Settings CRUD
│   │   │   │   ├── devices.ts     # Device management
│   │   │   │   ├── media.ts       # File upload/management
│   │   │   │   └── auth.ts        # Authentication
│   │   │   ├── websocket/         # Socket.IO handlers
│   │   │   ├── lib/               # Utilities (Prisma, upload)
│   │   │   └── server.ts          # Express app
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   └── migrations/        # DB migrations
│   │   ├── uploads/               # Uploaded files
│   │   └── package.json
│   └── frontend/                   # React SPA
│       ├── src/
│       │   ├── components/
│       │   │   ├── Dashboard/     # Dashboard cards
│       │   │   ├── Schedule/      # Schedule editor
│       │   │   ├── Settings/      # Theme/Font/Audio editors
│       │   │   ├── Devices/       # Device management
│       │   │   ├── Media/         # Media library
│       │   │   └── Display/       # Display client slides
│       │   ├── pages/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── SchedulePage.tsx
│       │   │   ├── SettingsPage.tsx
│       │   │   ├── DevicesPage.tsx
│       │   │   ├── MediaPage.tsx
│       │   │   └── DisplayClientPage.tsx
│       │   ├── hooks/             # Custom React hooks
│       │   ├── services/          # API client
│       │   ├── types/             # TypeScript types
│       │   └── App.tsx
│       └── package.json
├── webroot/                        # Legacy PHP (deprecated)
├── pnpm-workspace.yaml
└── package.json
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- pnpm (or npx)

### 1. Install Dependencies
```bash
npx pnpm install
```

### 2. Setup Database
```bash
# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE htmlsignage;
CREATE USER signage WITH PASSWORD 'signage123';
GRANT ALL PRIVILEGES ON DATABASE htmlsignage TO signage;
ALTER USER signage CREATEDB;
EOF
```

### 3. Configure Backend
```bash
cd packages/backend
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Run Migrations
```bash
cd packages/backend
npx prisma migrate dev
npx prisma generate
```

### 5. Start Development Servers
```bash
# From project root
pnpm dev

# Backend will run on: http://localhost:3000
# Frontend will run on: http://localhost:5173
```

### 6. Access the Application
- **Admin Interface**: http://192.168.178.93:5173
- **Display Client**: http://192.168.178.93:5173/display
- **API Health**: http://192.168.178.93:3000/health

## 📱 Pages & Routes

### Admin Interface
- `/` - Dashboard (overview, stats, quick actions)
- `/schedule` - Schedule Editor (weekly plan)
- `/devices` - Device Management (pairing, monitoring)
- `/media` - Media Library (upload, manage files)
- `/settings` - Settings Editor (theme, fonts, audio)
- `/login` - Login Page (authentication)

### Display Client
- `/display?deviceId=xxx` - Display Client (slideshow mode)

## 🎨 Features Detail

### Dashboard
- Real-time statistics (devices, media, schedule)
- System health indicators
- Quick action cards
- Recent activity timeline

### Schedule Editor
- Visual grid editor
- Group by days
- Add/edit/delete cells
- Time, title, subtitle, badges
- Sauna selection
- Auto-save with versioning

### Device Management
- Device pairing with unique ID
- Online/offline status tracking
- Heartbeat monitoring (2-minute interval)
- Remote commands (reload, restart, clear-cache)
- Device overrides (custom schedule/settings per device)
- Auto/Override mode

### Media Library
- Drag & drop file upload
- Supported formats:
  - Images: JPG, PNG, GIF, WebP, SVG
  - Audio: MP3, WAV, OGG
  - Video: MP4, WebM
- Max file size: 50MB
- Search and filter
- Copy URL, download, delete
- Visual preview for images

### Settings Editor
- **Theme Colors**: 4 preset palettes + advanced editor (20+ colors)
- **Fonts**: 11 scale sliders + weight control
- **Audio**: Enable/disable, file upload, volume, loop
- Live preview
- Version control

### Display Client
- Fullscreen slideshow mode
- Auto-rotation between slides
- Real-time updates via WebSocket
- Heartbeat to admin interface
- Remote control support
- Two slide types:
  - **Overview**: Full weekly schedule
  - **Clock**: Large digital clock with date

## 🔌 API Endpoints

### Schedule
- `GET /api/schedule` - Get active schedule
- `POST /api/schedule` - Save new schedule
- `GET /api/schedule/history` - Get schedule history

### Settings
- `GET /api/settings` - Get active settings
- `POST /api/settings` - Save new settings

### Devices
- `GET /api/devices` - List all devices
- `GET /api/devices/:id` - Get device details
- `POST /api/devices` - Create device (pairing)
- `PATCH /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Delete device
- `POST /api/devices/:id/heartbeat` - Send heartbeat
- `POST /api/devices/:id/control` - Send control command
- `POST /api/devices/:id/overrides` - Set device overrides
- `DELETE /api/devices/:id/overrides` - Clear overrides

### Media
- `GET /api/media` - List all media (filter by type, search)
- `GET /api/media/:id` - Get media details
- `POST /api/media/upload` - Upload file
- `DELETE /api/media/:id` - Delete media

### Auth
- `POST /api/auth/login` - Login (JWT)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Static Files
- `GET /uploads/:filename` - Serve uploaded files

## 🔧 Configuration

### Backend (.env)
```env
DATABASE_URL="postgresql://signage:signage123@localhost:5432/htmlsignage?schema=public"
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://192.168.178.93:5173
JWT_SECRET=your-secret-key
```

### Frontend (vite.config.ts)
- LAN access enabled (`host: '0.0.0.0'`)
- Proxy to backend
- HMR for development

## 🌐 Network Configuration

The system is configured for LAN access:
- Backend listens on `0.0.0.0:3000`
- Frontend listens on `0.0.0.0:5173`
- CORS allows `192.168.*` IPs in development

## 📦 Build & Deployment

### Production Build
```bash
# Build both packages
pnpm build

# Backend output: packages/backend/dist/
# Frontend output: packages/frontend/dist/
```

### Production Start
```bash
# Backend
cd packages/backend
node dist/server.js

# Frontend (serve with nginx/apache)
# Serve packages/frontend/dist/ as static files
```

### Environment Variables (Production)
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/db
FRONTEND_URL=https://your-domain.com
JWT_SECRET=strong-random-secret
```

## 🔐 Security Notes

- JWT-based authentication
- Bcrypt password hashing
- Helmet security headers
- CORS configuration
- Input validation with Zod
- SQL injection prevention (Prisma)
- File upload validation

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U signage -d htmlsignage -h localhost
```

### Port Already in Use
```bash
# Kill processes on port 3000 or 5173
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Git Permissions Issue
```bash
sudo chown -R $USER:$USER .git/
```

### Prisma Migration Failed
```bash
# Reset database (WARNING: deletes all data)
cd packages/backend
npx prisma migrate reset

# Grant CREATEDB permission
sudo -u postgres psql -c "ALTER USER signage CREATEDB;"
```

## 📝 Development Notes

- Use `pnpm` for package management
- TypeScript strict mode enabled
- ESLint + Prettier configured
- Git hooks for code quality
- Monorepo with pnpm workspaces

## 🎯 Roadmap

- [ ] User authentication implementation
- [ ] Data migration from SQLite
- [ ] Backup/restore functionality
- [ ] Audit log viewer
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Advanced analytics
- [ ] Email notifications

## 📄 License

Proprietary - Westfalenbad Hagen

## 👨‍💻 Development

Built with ❤️ using modern TypeScript stack.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
