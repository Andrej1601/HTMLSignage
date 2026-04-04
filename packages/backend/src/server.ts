import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import { createServer } from 'http';
import os from 'os';
import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { prisma } from './lib/prisma.js';
import { startMaintenanceScheduler, stopMaintenanceScheduler } from './lib/maintenance.js';
import { setupWebSocket } from './websocket/index.js';
import { UPLOAD_DIR } from './lib/upload.js';
import scheduleRouter from './routes/schedule.js';
import settingsRouter from './routes/settings.js';
import devicesRouter from './routes/devices/index.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import mediaRouter from './routes/media.js';
import systemRouter from './routes/system.js';
import saunasRouter from './routes/saunas.js';
import palettesRouter from './routes/palettes.js';
import slideshowWorkflowRouter from './routes/slideshowWorkflow.js';
import slideshowsRouter from './routes/slideshows.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);
const configuredFrontendUrl = (process.env.FRONTEND_URL || '').trim();
const allowAllOrigins = configuredFrontendUrl === '*';
const LOG_HTTP_REQUESTS = process.env.LOG_HTTP_REQUESTS === '1' || process.env.NODE_ENV === 'development';
const parsedSlowThreshold = Number.parseInt(process.env.LOG_HTTP_SLOW_THRESHOLD_MS || '1500', 10);
const LOG_HTTP_SLOW_THRESHOLD_MS = Number.isFinite(parsedSlowThreshold) ? parsedSlowThreshold : 1500;
const parsedShutdownTimeout = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10);
const SHUTDOWN_TIMEOUT_MS = Number.isFinite(parsedShutdownTimeout) ? parsedShutdownTimeout : 10000;

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

    // In production, only allow explicitly configured FRONTEND_URL
    // Empty FRONTEND_URL = no CORS allowed (secure default)
    if (allowAllOrigins) {
      return callback(null, true);
    }

    if (configuredFrontendUrl && origin === configuredFrontendUrl) {
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
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CSRF protection via custom header check for cookie-based auth
app.use((req, res, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isMutation && req.cookies?.auth_token) {
    const csrfToken = req.headers['x-csrf-token'];
    if (!csrfToken || csrfToken !== '1') {
      return res.status(403).json({
        error: 'csrf-token-missing',
        message: 'CSRF token required for mutation requests.',
      });
    }
  }
  next();
});

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as typeof req & { requestId?: string }).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Request logging
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startedAt;
    const shouldLog = LOG_HTTP_REQUESTS || res.statusCode >= 400 || duration >= LOG_HTTP_SLOW_THRESHOLD_MS;
    if (!shouldLog) return;
    console.log(JSON.stringify({
      type: 'http_request',
      timestamp: new Date(startedAt).toISOString(),
      requestId: (req as typeof req & { requestId?: string }).requestId || null,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
    }));
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
app.use('/api/slideshow', slideshowWorkflowRouter);
app.use('/api/slideshows', slideshowsRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as typeof req & { requestId?: string }).requestId || null;
  console.error(JSON.stringify({
    type: 'http_error',
    requestId,
    method: req.method,
    path: req.path,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }));
  res.status(500).json({ 
    error: 'internal-server-error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    requestId,
  });
});

// WebSocket Setup
setupWebSocket(io);
startMaintenanceScheduler();

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
let shutdownPromise: Promise<void> | null = null;

function closeHttpServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    io.close(() => resolve());
  });
}

const shutdown = async (signal: string) => {
  if (shutdownPromise) {
    await shutdownPromise;
    return;
  }

  shutdownPromise = (async () => {
    console.log(`${signal} signal received: closing services`);
    stopMaintenanceScheduler();

    const timeout = setTimeout(() => {
      console.error(`Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref?.();

    try {
      const results = await Promise.allSettled([
        closeSocketServer(),
        closeHttpServer(),
        prisma.$disconnect(),
      ]);

      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected && rejected.status === 'rejected') {
        throw rejected.reason;
      }

      console.log('Shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Shutdown failed', error);
      process.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  })();

  await shutdownPromise;
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    type: 'unhandled_rejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
  process.exit(1);
});
