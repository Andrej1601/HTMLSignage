import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Most admin data (schedule, settings, slideshows, devices, media) is
      // kept fresh by WebSocket-driven invalidation, so a longer staleness
      // window avoids redundant background refetches. gcTime is set explicitly
      // so cache for long-lived admin sessions isn't evicted too aggressively.
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <CommandPaletteProvider>
          <App />
        </CommandPaletteProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
}
