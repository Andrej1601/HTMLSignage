import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { API_URL } from '@/config/env';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  onScheduleUpdate?: (data: Schedule) => void;
  onSettingsUpdate?: (data: Settings) => void;
  onDeviceCommand?: (command: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = API_URL,
    autoConnect = true,
    onScheduleUpdate,
    onSettingsUpdate,
    onDeviceCommand,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log('[WebSocket] Connecting to', url);

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err);
      setError(err.message);
      setIsConnected(false);
    });

    // Schedule updates
    socket.on('schedule:updated', (data: Schedule) => {
      console.log('[WebSocket] Schedule updated:', data);
      onScheduleUpdate?.(data);
    });

    // Settings updates
    socket.on('settings:updated', (data: Settings) => {
      console.log('[WebSocket] Settings updated:', data);
      onSettingsUpdate?.(data);
    });

    // Device commands
    socket.on('device:command', (data: { command?: string }) => {
      console.log('[WebSocket] Device command:', data);
      if (data?.command) {
        onDeviceCommand?.(data.command);
      }
    });

    socketRef.current = socket;
  }, [url, onScheduleUpdate, onSettingsUpdate, onDeviceCommand]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Disconnecting');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((channel: string, deviceId?: string) => {
    if (!socketRef.current) return;

    console.log('[WebSocket] Subscribing to', channel, deviceId);

    switch (channel) {
      case 'schedule':
        socketRef.current.emit('subscribe:schedule');
        break;
      case 'settings':
        socketRef.current.emit('subscribe:settings');
        break;
      case 'device':
        if (deviceId) {
          socketRef.current.emit('subscribe:device', deviceId);
        }
        break;
    }
  }, []);

  const unsubscribe = useCallback((channel: string, deviceId?: string) => {
    if (!socketRef.current) return;

    console.log('[WebSocket] Unsubscribing from', channel, deviceId);

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
      connect();
    }

    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, url]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}
