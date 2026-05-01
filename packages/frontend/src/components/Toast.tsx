import { useToastStore, type ToastType } from '@/stores/toastStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import clsx from 'clsx';

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styleMap: Record<ToastType, string> = {
  success: 'bg-spa-success-light border-spa-success/30 text-spa-success-dark',
  error: 'bg-spa-error-light border-spa-error/30 text-spa-error-dark',
  warning: 'bg-spa-warning-light border-spa-warning/30 text-spa-warning-dark',
  info: 'bg-spa-info-light border-spa-info/30 text-spa-info-dark',
};

const iconStyleMap: Record<ToastType, string> = {
  success: 'text-spa-success',
  error: 'text-spa-error',
  warning: 'text-spa-warning',
  info: 'text-spa-info',
};

// `role`/`aria-live` werden pro Toast je nach Schweregrad gesetzt:
//   - error/warning  → role=alert + aria-live=assertive (sofortige Ansage)
//   - success/info   → role=status + aria-live=polite    (höflicher Hinweis)
// Der Container selbst ist eine semantische Region OHNE eigenes
// aria-live, damit es zu keinem Doppel-Announcement durch Container +
// Item kommt (vorheriges Verhalten: Container=polite + Item=alert).
const ariaForType: Record<ToastType, { role: 'alert' | 'status'; live: 'assertive' | 'polite' }> = {
  success: { role: 'status', live: 'polite' },
  info:    { role: 'status', live: 'polite' },
  warning: { role: 'alert',  live: 'assertive' },
  error:   { role: 'alert',  live: 'assertive' },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Benachrichtigungen"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full"
    >
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        const aria = ariaForType[t.type];
        return (
          <div
            key={t.id}
            role={aria.role}
            aria-live={aria.live}
            className={clsx(
              'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-slide-in-right',
              styleMap[t.type]
            )}
          >
            <Icon className={clsx('w-5 h-5 shrink-0 mt-0.5', iconStyleMap[t.type])} aria-hidden="true" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-spa-bg-primary"
              aria-label="Benachrichtigung schließen"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
