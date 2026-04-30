import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@htmlsignage/shared/websocket';
import { API_URL } from '@/config/env';
import { ENV_IS_DEV } from '@/config/env';
import { WS_RECONNECT } from '@/utils/constants';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  onScheduleUpdate?: (data: Schedule) => void;
  onSettingsUpdate?: (data: Settings) => void;
  onDeviceCommand?: (command: string) => void;
  onDeviceUpdate?: (data: Record<string, unknown>) => void;
  onBulkDeviceUpdate?: (devices: Record<string, unknown>[]) => void;
  /** Called after a WebSocket reconnect so stale data can be refetched. */
  onReconnect?: () => void;
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
    onBulkDeviceUpdate,
    onReconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<TypedSocket | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const disconnectRequestedRef = useRef(false);

  // Store callbacks in refs so the socket listeners always call the latest version
  // without causing reconnects when the callbacks change identity.
  const onScheduleUpdateRef = useRef(onScheduleUpdate);
  const onSettingsUpdateRef = useRef(onSettingsUpdate);
  const onDeviceCommandRef = useRef(onDeviceCommand);
  const onDeviceUpdateRef = useRef(onDeviceUpdate);
  const onBulkDeviceUpdateRef = useRef(onBulkDeviceUpdate);
  const onReconnectRef = useRef(onReconnect);

  useEffect(() => {
    onScheduleUpdateRef.current = onScheduleUpdate;
    onSettingsUpdateRef.current = onSettingsUpdate;
    onDeviceCommandRef.current = onDeviceCommand;
    onDeviceUpdateRef.current = onDeviceUpdate;
    onBulkDeviceUpdateRef.current = onBulkDeviceUpdate;
    onReconnectRef.current = onReconnect;
  });

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
      let io: Awaited<ReturnType<typeof loadSocketIoClient>>['io'];
      try {
        ({ io } = await loadSocketIoClient());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Socket.IO client failed to load';
        console.error('[WebSocket] Client load failed:', err);
        setIsConnected(false);
        setError(message);
        return;
      }

      if (disconnectRequestedRef.current || socketRef.current) {
        return;
      }

      const socket: TypedSocket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: WS_RECONNECT.delayMs,
        reconnectionDelayMax: WS_RECONNECT.delayMaxMs,
        reconnectionAttempts: WS_RECONNECT.attempts,
        randomizationFactor: WS_RECONNECT.randomizationFactor,
        timeout: WS_RECONNECT.timeoutMs,
      });

      let firstConnect = true;
      socket.off('connect').on('connect', () => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Connected:', socket.id);
        }
        const wasReconnect = !firstConnect;
        firstConnect = false;
        setIsConnected(true);
        setError(null);
        // On reconnect, notify so callers can refetch stale data
        if (wasReconnect) {
          onReconnectRef.current?.();
        }
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
      // Event payload types are inferred from the typed Socket — schema drift
      // breaks the build at compile time instead of runtime.
      socket.off('schedule:updated').on('schedule:updated', (data) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Schedule updated:', data);
        }
        onScheduleUpdateRef.current?.(data as Schedule);
      });

      socket.off('settings:updated').on('settings:updated', (data) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Settings updated:', data);
        }
        onSettingsUpdateRef.current?.(data as Settings);
      });

      socket.off('device:command').on('device:command', (data) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Device command:', data);
        }
        if (data?.command) {
          onDeviceCommandRef.current?.(data.command);
        }
      });

      socket.off('device:updated').on('device:updated', (data) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Device updated:', data);
        }
        onDeviceUpdateRef.current?.(data);

        const command = typeof data?.command === 'string' ? data.command : undefined;
        if (command) {
          onDeviceCommandRef.current?.(command);
        }
      });

      socket.off('devices:bulk-updated').on('devices:bulk-updated', (devices) => {
        if (ENV_IS_DEV) {
          console.log('[WebSocket] Bulk device update:', devices.length, 'devices');
        }
        onBulkDeviceUpdateRef.current?.(devices);
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
        socketRef.current.emit('subscribe:schedule', { token: deviceToken });
        break;
      case 'settings':
        socketRef.current.emit('subscribe:settings', { token: deviceToken });
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
