import { createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface WebSocketContextValue {
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue>({ isConnected: false });

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useWebSocket({ autoConnect: true });
  return (
    <WebSocketContext.Provider value={{ isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketStatus(): WebSocketContextValue {
  return useContext(WebSocketContext);
}
