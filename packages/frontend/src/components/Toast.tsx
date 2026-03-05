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

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Benachrichtigungen"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full"
    >
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        return (
          <div
            key={t.id}
            role="alert"
            className={clsx(
              'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5',
              styleMap[t.type]
            )}
          >
            <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', iconStyleMap[t.type])} aria-hidden="true" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 transition-colors"
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
