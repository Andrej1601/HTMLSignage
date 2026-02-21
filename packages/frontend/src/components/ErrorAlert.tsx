import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorAlert({
  title = 'Fehler beim Laden',
  message,
  error,
  onRetry,
  retryLabel = 'Erneut versuchen',
}: ErrorAlertProps) {
  const errorMessage = message
    || (error instanceof Error ? error.message : null)
    || 'Ein unerwarteter Fehler ist aufgetreten.';

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" role="alert">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <h3 className="font-semibold text-red-900">{title}</h3>
        <p className="text-red-700 text-sm mt-1">{errorMessage}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
