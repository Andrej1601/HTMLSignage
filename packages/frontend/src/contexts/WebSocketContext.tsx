import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';

interface WebSocketContextValue {
  isConnected: boolean;
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({ isConnected: false, error: null });

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const onScheduleUpdate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['schedule'] });
  }, [queryClient]);

  const onSettingsUpdate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
  }, [queryClient]);

  const onBulkDeviceUpdate = useCallback(() => {
    // Single invalidation instead of N individual broadcasts
    void queryClient.invalidateQueries({ queryKey: ['devices'] });
  }, [queryClient]);

  const onReconnect = useCallback(() => {
    // After a WebSocket reconnect, catch up on any changes missed while offline
    void queryClient.invalidateQueries({ queryKey: ['schedule'] });
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
    void queryClient.invalidateQueries({ queryKey: ['devices'] });
  }, [queryClient]);

  const { isConnected, error } = useWebSocket({
    autoConnect: true,
    onScheduleUpdate,
    onSettingsUpdate,
    onBulkDeviceUpdate,
    onReconnect,
  });

  return (
    <WebSocketContext.Provider value={{ isConnected, error }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketStatus(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
