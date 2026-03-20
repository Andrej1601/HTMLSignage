import React, { startTransition } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {
  clearChunkRecoveryAttempt,
  installChunkLoadRecovery,
} from './utils/chunkLoadRecovery';

function isDisplayBootstrapPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return normalizedPath === '/display';
}

function BootstrapFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div
        className="w-8 h-8 border-[3px] border-spa-bg-secondary border-t-spa-primary rounded-full animate-spin"
        role="status"
        aria-label="Seite wird geladen"
      />
    </div>
  );
}

async function bootstrap(): Promise<void> {
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    throw new Error('Root element #root not found');
  }

  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <BootstrapFallback />
    </React.StrictMode>,
  );

  const appModule = isDisplayBootstrapPath(window.location.pathname)
    ? await import('./DisplayApp')
    : await import('./AdminApp');

  const RootApp = appModule.default;
  clearChunkRecoveryAttempt();

  startTransition(() => {
    root.render(
      <React.StrictMode>
        <RootApp />
      </React.StrictMode>,
    );
  });
}

installChunkLoadRecovery();
void bootstrap();
