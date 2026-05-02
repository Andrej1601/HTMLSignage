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

  const onSlideshowUpdate = useCallback(() => {
    // Slideshow ändert sich → react-query invalidieren, damit
    // SlideshowSelector / SlideshowPage / DashboardPage frische Daten
    // bekommen. Das deckt auch den parallel-Editor-Fall ab: Admin A
    // speichert, Admin B sieht's automatisch im UI.
    void queryClient.invalidateQueries({ queryKey: ['slideshows'] });
  }, [queryClient]);

  const onReconnect = useCallback(() => {
    // After a WebSocket reconnect, catch up on any changes missed while offline
    void queryClient.invalidateQueries({ queryKey: ['schedule'] });
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
    void queryClient.invalidateQueries({ queryKey: ['devices'] });
    void queryClient.invalidateQueries({ queryKey: ['slideshows'] });
  }, [queryClient]);

  const { isConnected, error } = useWebSocket({
    autoConnect: true,
    onScheduleUpdate,
    onSettingsUpdate,
    onBulkDeviceUpdate,
    onSlideshowUpdate,
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
