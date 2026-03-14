import express from 'express';
import path from 'path';
import { createServer } from 'http';
import os from 'os';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma.js';
import { setupWebSocket } from './websocket/index.js';
import { UPLOAD_DIR } from './lib/upload.js';
import scheduleRouter from './routes/schedule.js';
import settingsRouter from './routes/settings.js';
import devicesRouter from './routes/devices.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import mediaRouter from './routes/media.js';
import systemRouter from './routes/system.js';
import saunasRouter from './routes/saunas.js';
import palettesRouter from './routes/palettes.js';


dotenv.config();

const app = express();
const httpServer = createServer(app);
const configuredFrontendUrl = (process.env.FRONTEND_URL || '').trim();
const allowAllOrigins = configuredFrontendUrl === '' || configuredFrontendUrl === '*';
const LOG_HTTP_REQUESTS = process.env.LOG_HTTP_REQUESTS === '1' || process.env.NODE_ENV === 'development';
const parsedSlowThreshold = Number.parseInt(process.env.LOG_HTTP_SLOW_THRESHOLD_MS || '1500', 10);
const LOG_HTTP_SLOW_THRESHOLD_MS = Number.isFinite(parsedSlowThreshold) ? parsedSlowThreshold : 1500;

const isDevAllowedOrigin = (origin: string): boolean => {
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    if (hostname.endsWith('.local')) {
      return true;
    }
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) {
      return true;
    }
    return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
  } catch {
    return false;
  }
};

// CORS Configuration - Allow LAN access in development
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // In development, allow localhost and private LAN origins
    if (process.env.NODE_ENV === 'development') {
      if (isDevAllowedOrigin(origin)) {
        return callback(null, true);
      }
    }

    // In production, allow all origins when FRONTEND_URL is "*" (or empty)
    if (allowAllOrigins || origin === configuredFrontendUrl) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Socket.IO Setup
export const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const shouldLog = LOG_HTTP_REQUESTS || res.statusCode >= 400 || duration >= LOG_HTTP_SLOW_THRESHOLD_MS;
    if (!shouldLog) return;
    console.log(`[${timestamp}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Serve uploaded files with hardened headers.
app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (ext === '.svg') {
    res.setHeader('Content-Disposition', 'attachment');
    res.type('application/octet-stream');
  }
  next();
}, express.static(UPLOAD_DIR, {
  immutable: true,
  maxAge: '30d',
  setHeaders: (res, filePath) => {
    if (path.extname(filePath).toLowerCase() === '.svg') {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  },
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/system', systemRouter);
app.use('/api/saunas', saunasRouter);
app.use('/api/palettes', palettesRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    error: 'internal-server-error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// WebSocket Setup
setupWebSocket(io);

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0'; // Listen on all network interfaces
httpServer.listen(PORT, HOST, () => {
  const networkInterfaces = os.networkInterfaces();
  const lanAddresses = Object.values(networkInterfaces)
    .flatMap((entries) => entries ?? [])
    .filter(
      (entry): entry is os.NetworkInterfaceInfo =>
        Boolean(entry) && entry.family === 'IPv4' && !entry.internal
    )
    .map((entry) => entry.address);

  console.log(`Server running on http://localhost:${PORT}`);
  if (lanAddresses.length > 0) {
    lanAddresses.forEach((address) => {
      console.log(`Network: http://${address}:${PORT}`);
    });
  }
  console.log('WebSocket server ready');
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
});
