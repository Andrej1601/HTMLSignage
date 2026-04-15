import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { isChunkLoadFailure } from '@/utils/chunkLoadRecovery';

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return typeof error.data === 'string' && error.data.trim() !== ''
      ? error.data
      : `${error.status} ${error.statusText}`;
  }

  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unbekannter Fehler';
}

export function RouteErrorPage() {
  const error = useRouteError();
  const message = getErrorMessage(error);
  const isChunkError = isChunkLoadFailure(error) || isChunkLoadFailure(message);

  return (
    <div className="min-h-screen flex items-center justify-center bg-spa-bg-primary p-4">
      <div className="bg-spa-surface rounded-2xl shadow-xl max-w-xl w-full p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-spa-error-light rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8 text-spa-error" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-spa-text-primary mb-2">
          {isChunkError ? 'Die Oberfläche wurde gerade aktualisiert' : 'Seite konnte nicht geladen werden'}
        </h1>
        <p className="text-spa-text-secondary mb-6">
          {isChunkError
            ? 'Offenbar greift dein Browser noch auf eine ältere JavaScript-Datei zu. Ein Neuladen holt den aktuellen Stand.'
            : 'Beim Laden dieser Seite ist ein Fehler aufgetreten. Bitte versuche es erneut.'}
        </p>

        <details className="mb-6 text-left">
          <summary className="cursor-pointer text-sm text-spa-text-secondary hover:text-spa-text-primary">
            Technische Details
          </summary>
          <pre className="mt-2 p-3 bg-spa-error-light border border-spa-error/30 rounded-lg text-xs text-spa-error-dark overflow-auto max-h-32">
            {message}
          </pre>
        </details>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-lg hover:bg-spa-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Seite neu laden
          </button>
          <button
            onClick={() => window.location.assign('/')}
            className="px-4 py-2 border border-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-bg-secondary transition-colors"
          >
            Zum Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
