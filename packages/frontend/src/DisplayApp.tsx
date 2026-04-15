import { useEffect } from 'react';
import { DisplayErrorBoundary } from './components/Display/DisplayErrorBoundary';
import { DisplayClientPage } from './pages/DisplayClientPage';

function useDisplayServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/display-sw.js', { scope: '/' })
      .catch(() => {
        // Service worker registration failed — non-fatal for display operation
      });
  }, []);
}

export default function DisplayApp() {
  useDisplayServiceWorker();

  return (
    <DisplayErrorBoundary>
      <DisplayClientPage />
    </DisplayErrorBoundary>
  );
}
