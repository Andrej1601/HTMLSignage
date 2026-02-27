import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

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
    <div className="bg-spa-error-light border border-spa-error/30 rounded-lg p-4 flex items-start gap-3" role="alert">
      <AlertCircle className="w-5 h-5 text-spa-error flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <h3 className="font-semibold text-spa-error-dark">{title}</h3>
        <p className="text-spa-error-dark/80 text-sm mt-1">{errorMessage}</p>
        {onRetry && (
          <Button
            variant="danger"
            size="sm"
            icon={RefreshCw}
            onClick={onRetry}
            className="mt-3"
          >
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
