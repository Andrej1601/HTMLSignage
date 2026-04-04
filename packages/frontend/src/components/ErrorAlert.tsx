import { useRef, useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

/** Map common error patterns to helpful German messages */
const ERROR_HINTS: Array<{ pattern: RegExp; hint: string }> = [
  { pattern: /401|unauthorized/i, hint: 'Deine Sitzung ist möglicherweise abgelaufen. Bitte melde dich erneut an.' },
  { pattern: /403|forbidden/i, hint: 'Du hast keine Berechtigung für diese Aktion. Wende dich an einen Administrator.' },
  { pattern: /404|not found/i, hint: 'Die angeforderte Ressource wurde nicht gefunden.' },
  { pattern: /409|conflict/i, hint: 'Es gibt einen Konflikt mit einem anderen Vorgang. Lade die Seite neu und versuche es erneut.' },
  { pattern: /413|too large/i, hint: 'Die Datei ist zu groß. Reduziere die Dateigröße und versuche es erneut.' },
  { pattern: /429|rate.?limit/i, hint: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.' },
  { pattern: /500|internal server/i, hint: 'Interner Serverfehler. Versuche es in einigen Sekunden erneut.' },
  { pattern: /network|fetch|ECONNREFUSED|timeout/i, hint: 'Netzwerkproblem. Prüfe deine Verbindung und den Serverstatus.' },
];

function getErrorHint(error: unknown, message?: string): string | null {
  const text = message || (error instanceof Error ? error.message : String(error ?? ''));
  for (const { pattern, hint } of ERROR_HINTS) {
    if (pattern.test(text)) return hint;
  }
  return null;
}

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
  const alertRef = useRef<HTMLDivElement>(null);
  const errorMessage = message
    || (error instanceof Error ? error.message : null)
    || 'Ein unerwarteter Fehler ist aufgetreten.';

  const hint = getErrorHint(error, message);

  useEffect(() => {
    alertRef.current?.focus();
  }, [errorMessage]);

  return (
    <div
      ref={alertRef}
      tabIndex={-1}
      className="bg-spa-error-light border border-spa-error/30 rounded-lg p-4 flex items-start gap-3 focus:outline-hidden"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className="w-5 h-5 text-spa-error shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <h3 className="font-semibold text-spa-error-dark">{title}</h3>
        <p className="text-spa-error-dark/80 text-sm mt-1">{errorMessage}</p>
        {hint && (
          <p className="text-spa-error-dark/60 text-xs mt-1">{hint}</p>
        )}
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
