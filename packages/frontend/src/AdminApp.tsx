import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
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
