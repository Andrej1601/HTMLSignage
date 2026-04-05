import { createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface WebSocketContextValue {
  isConnected: boolean;
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({ isConnected: false, error: null });

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isConnected, error } = useWebSocket({ autoConnect: true });
  return (
    <WebSocketContext.Provider value={{ isConnected, error }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketStatus(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
