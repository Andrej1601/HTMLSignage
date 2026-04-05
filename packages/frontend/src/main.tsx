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

function RootErrorBoundary({ error, resetErrorBoundary }: { error: Error | null; resetErrorBoundary: () => void }) {
  return (
    <div className="flex items-center justify-center h-screen bg-spa-bg-primary">
      <div className="text-center max-w-md px-6">
        <h1 className="text-2xl font-bold text-spa-error mb-2">Unerwarteter Fehler</h1>
        <p className="text-spa-text-secondary mb-4">
          Die Anwendung konnte nicht gestartet werden. Bitte versuche es erneut.
        </p>
        {error && (
          <pre className="text-xs text-left bg-spa-bg-secondary p-3 rounded-lg overflow-auto max-h-40 mb-4 text-spa-text-secondary">
            {error.message}
          </pre>
        )}
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-spa-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}

class RootErrorBoundaryClass extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <RootErrorBoundary
          error={this.state.error}
          resetErrorBoundary={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
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
        <RootErrorBoundaryClass>
          <RootApp />
        </RootErrorBoundaryClass>
      </React.StrictMode>,
    );
  });
}

installChunkLoadRecovery();
void bootstrap();
