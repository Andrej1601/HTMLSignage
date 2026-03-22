import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { API_URL } from '@/config/env';
import { ENV_IS_DEV } from '@/config/env';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  onScheduleUpdate?: (data: Schedule) => void;
  onSettingsUpdate?: (data: Settings) => void;
  onDeviceCommand?: (command: string) => void;
  onDeviceUpdate?: (data: Record<string, unknown>) => void;
}

let socketIoClientPromise: Promise<typeof import('socket.io-client')> | null = null;

function loadSocketIoClient() {
  if (!socketIoClientPromise) {
    socketIoClientPromise = import('socket.io-client');
  }

  return socketIoClientPromise;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = API_URL,
    autoConnect = true,
    onScheduleUpdate,
    onSettingsUpdate,
    onDeviceCommand,
    onDeviceUpdate,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const disconnectRequestedRef = useRef(false);

  // Store callbacks in refs so the socket listeners always call the latest version
  // without causing reconnects when the callbacks change identity.
  const onScheduleUpdateRef = useRef(onScheduleUpdate);
  const onSettingsUpdateRef = useRef(onSettingsUpdate);
  const onDeviceCommandRef = useRef(onDeviceCommand);
  const onDeviceUpdateRef = useRef(onDeviceUpdate);

  onScheduleUpdateRef.current = onScheduleUpdate;
  onSettingsUpdateRef.current = onSettingsUpdate;
  onDeviceCommandRef.current = onDeviceCommand;
  onDeviceUpdateRef.current = onDeviceUpdate;

  const connect = useCallback(async () => {
    disconnectRequestedRef.current = false;

    if (socketRef.current) {
      if (socketRef.current.connected) return;
      socketRef.current.connect();
      return;
    }

    if (connectPromiseRef.current) {
      return connectPromiseRef.current;
    }

    if (ENV_IS_DEV) {
      console.log('[WebSocket] Connecting to', url);
    }

    connectPromiseRef.current = (async () => {
      const { io } = await loadSocketIoClient();

      if (disconnectRequestedRef.current || socketRef.current) {
        return;
      }

      const socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: Infinity,
        randomizationFactor: 0.5,
        timeout: 10000,
      });

      socket.off('connect').on('connect', () => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Connected:', socket.id);
        }
        setIsConnected(true);
        setError(null);
      });

      socket.off('disconnect').on('disconnect', (reason) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Disconnected:', reason);
        }
        setIsConnected(false);
      });

      socket.off('connect_error').on('connect_error', (err) => {
        if (ENV_IS_DEV) {
          console.error('[WebSocket] Connection error:', err);
        }
        setError(err.message);
        setIsConnected(false);
      });

      // Keep listeners stable via refs without reconnecting on each render.
      socket.off('schedule:updated').on('schedule:updated', (data: Schedule) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Schedule updated:', data);
        }
        onScheduleUpdateRef.current?.(data);
      });

      socket.off('settings:updated').on('settings:updated', (data: Settings) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Settings updated:', data);
        }
        onSettingsUpdateRef.current?.(data);
      });

      socket.off('device:command').on('device:command', (data: { command?: string }) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Device command:', data);
        }
        if (data?.command) {
          onDeviceCommandRef.current?.(data.command);
        }
      });

      socket.off('device:updated').on('device:updated', (data: Record<string, unknown>) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Device updated:', data);
        }
        onDeviceUpdateRef.current?.(data);

        const command = typeof data?.command === 'string' ? data.command : undefined;
        if (command) {
          onDeviceCommandRef.current?.(command);
        }
      });

      socketRef.current = socket;
    })().finally(() => {
      connectPromiseRef.current = null;
    });

    return connectPromiseRef.current;
  }, [url]);

  const disconnect = useCallback(() => {
    disconnectRequestedRef.current = true;

    if (socketRef.current) {
      if (ENV_IS_DEV) {
        console.log('[WebSocket] Disconnecting');
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((channel: string, deviceId?: string, deviceToken?: string) => {
    if (!socketRef.current) return;

    if (ENV_IS_DEV) {
      console.log('[WebSocket] Subscribing to', channel, ...(deviceId ? [deviceId] : []));
    }

    switch (channel) {
      case 'schedule':
        socketRef.current.emit('subscribe:schedule');
        break;
      case 'settings':
        socketRef.current.emit('subscribe:settings');
        break;
      case 'device':
        if (deviceId) {
          socketRef.current.emit('subscribe:device', {
            deviceId,
            deviceToken,
          });
        }
        break;
    }
  }, []);

  const unsubscribe = useCallback((channel: string, deviceId?: string) => {
    if (!socketRef.current) return;

    if (ENV_IS_DEV) {
      console.log('[WebSocket] Unsubscribing from', channel, ...(deviceId ? [deviceId] : []));
    }

    switch (channel) {
      case 'schedule':
        socketRef.current.emit('unsubscribe:schedule');
        break;
      case 'settings':
        socketRef.current.emit('unsubscribe:settings');
        break;
      case 'device':
        if (deviceId) {
          socketRef.current.emit('unsubscribe:device', deviceId);
        }
        break;
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      void connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, url, connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}
