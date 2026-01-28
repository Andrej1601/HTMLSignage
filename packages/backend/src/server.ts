import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from './lib/prisma.js';
import { setupWebSocket } from './websocket/index.js';
import { UPLOAD_DIR } from './lib/upload.js';
import scheduleRouter from './routes/schedule.js';
import settingsRouter from './routes/settings.js';
import devicesRouter from './routes/devices.js';
import authRouter from './routes/auth.js';
import mediaRouter from './routes/media.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS Configuration - Allow LAN access in development
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // In development, allow localhost and LAN IPs
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('192.168.') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // In production, only allow configured frontend URL
    if (origin === process.env.FRONTEND_URL) {
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
app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Serve uploaded files
app.use('/uploads', express.static(UPLOAD_DIR));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/media', mediaRouter);

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
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Network: http://192.168.178.93:${PORT}`);
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
