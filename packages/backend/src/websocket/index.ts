import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setupWebSocket(ioInstance: SocketIOServer) {
  io = ioInstance;

  io.on('connection', (socket) => {
    console.log(`[ws] Client connected: ${socket.id}`);

    // Subscribe to schedule updates
    socket.on('subscribe:schedule', () => {
      socket.join('schedule-updates');
      console.log(`[ws] ${socket.id} subscribed to schedule updates`);
    });

    // Subscribe to settings updates
    socket.on('subscribe:settings', () => {
      socket.join('settings-updates');
      console.log(`[ws] ${socket.id} subscribed to settings updates`);
    });

    // Subscribe to device updates
    socket.on('subscribe:device', (deviceId: string) => {
      socket.join(`device:${deviceId}`);
      console.log(`[ws] ${socket.id} subscribed to device ${deviceId}`);
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
      console.log(`[ws] Client disconnected: ${socket.id}`);
    });
  });
}

// Broadcast functions
export function broadcastScheduleUpdate(data: unknown) {
  if (io) {
    io.to('schedule-updates').emit('schedule:updated', data);
    console.log('[ws] Broadcasted schedule update');
  }
}

export function broadcastSettingsUpdate(data: unknown) {
  if (io) {
    io.to('settings-updates').emit('settings:updated', data);
    console.log('[ws] Broadcasted settings update');
  }
}

export function broadcastDeviceUpdate(data: unknown) {
  if (io) {
    // Broadcast to all connected clients (for device list updates)
    io.emit('device:updated', data);
    console.log('[ws] Broadcasted device update');
  }
}

export function broadcastDeviceCommand(deviceId: string, data: unknown) {
  if (io) {
    // Broadcast to specific device
    io.to(`device:${deviceId}`).emit('device:command', data);
    console.log(`[ws] Broadcasted device command for ${deviceId}`);
  }
}
