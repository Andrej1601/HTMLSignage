import { Server as SocketIOServer } from 'socket.io';
import { verifyAnyToken, verifyDeviceToken } from '../lib/auth.js';

let io: SocketIOServer | null = null;
const LOG_WS = process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug';

export function setupWebSocket(ioInstance: SocketIOServer) {
  io = ioInstance;

  io.on('connection', (socket) => {
    if (LOG_WS) {
      console.log(`[ws] Client connected: ${socket.id}`);
    }

    // Subscribe to schedule updates (requires valid user or device token)
    socket.on('subscribe:schedule', (payload?: string | { token?: string }) => {
      const token = typeof payload === 'string' ? payload : payload?.token;
      if (!verifyAnyToken(token)) {
        socket.emit('subscribe:error', { error: 'authentication-required', channel: 'schedule' });
        return;
      }
      socket.join('schedule-updates');
      if (LOG_WS) {
        console.log(`[ws] ${socket.id} subscribed to schedule updates`);
      }
    });

    // Subscribe to settings updates (requires valid user or device token)
    socket.on('subscribe:settings', (payload?: string | { token?: string }) => {
      const token = typeof payload === 'string' ? payload : payload?.token;
      if (!verifyAnyToken(token)) {
        socket.emit('subscribe:error', { error: 'authentication-required', channel: 'settings' });
        return;
      }
      socket.join('settings-updates');
      if (LOG_WS) {
        console.log(`[ws] ${socket.id} subscribed to settings updates`);
      }
    });

    // Subscribe to device updates
    socket.on('subscribe:device', (payload: string | { deviceId?: string; deviceToken?: string }) => {
      const deviceId = typeof payload === 'string' ? payload : payload?.deviceId;
      const deviceToken = typeof payload === 'string' ? undefined : payload?.deviceToken;
      if (!deviceId || !deviceToken) {
        socket.emit('device:auth-error', { error: 'device-token-required' });
        return;
      }

      const verified = verifyDeviceToken(deviceToken);
      if (!verified || verified.deviceId !== deviceId) {
        socket.emit('device:auth-error', { error: 'invalid-device-token' });
        return;
      }

      socket.join(`device:${deviceId}`);
      if (LOG_WS) {
        console.log(`[ws] ${socket.id} subscribed to device ${deviceId}`);
      }
    });

    // Unsubscribe handlers
    socket.on('unsubscribe:schedule', () => {
      socket.leave('schedule-updates');
    });

    socket.on('unsubscribe:settings', () => {
      socket.leave('settings-updates');
    });

    socket.on('unsubscribe:device', (deviceId: string) => {
      socket.leave(`device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      if (LOG_WS) {
        console.log(`[ws] Client disconnected: ${socket.id}`);
      }
    });
  });
}

// Broadcast functions
export function broadcastScheduleUpdate(data: unknown) {
  if (io) {
    io.to('schedule-updates').emit('schedule:updated', data);
    if (LOG_WS) {
      console.log('[ws] Broadcasted schedule update');
    }
  }
}

export function broadcastSettingsUpdate(data: unknown) {
  if (io) {
    io.to('settings-updates').emit('settings:updated', data);
    if (LOG_WS) {
      console.log('[ws] Broadcasted settings update');
    }
  }
}

export function broadcastDeviceUpdate(data: unknown) {
  if (io) {
    io.emit('device:updated', data);
    if (LOG_WS) {
      console.log('[ws] Broadcasted device update');
    }
  }
}

/**
 * Emits a single `devices:bulk-updated` event with all updated devices instead
 * of N individual `device:updated` events.  Prevents broadcast storms during
 * bulk operations (e.g. 50 devices × 20 admin sockets = 1 000 events → 1 event).
 */
export function broadcastBulkDeviceUpdate(devices: unknown[]) {
  if (io) {
    io.emit('devices:bulk-updated', devices);
    if (LOG_WS) {
      console.log(`[ws] Broadcasted bulk device update (${devices.length} devices)`);
    }
  }
}

export function broadcastDeviceCommand(deviceId: string, data: unknown) {
  if (io) {
    // Broadcast to specific device
    io.to(`device:${deviceId}`).emit('device:command', data);
    if (LOG_WS) {
      console.log(`[ws] Broadcasted device command for ${deviceId}`);
    }
  }
}
