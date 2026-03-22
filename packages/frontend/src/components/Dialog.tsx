import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional icon element shown next to the title */
  titleIcon?: ReactNode;
  size?: DialogSize;
  /** Whether clicking the overlay closes the dialog */
  closeOnOverlayClick?: boolean;
  /** Whether pressing ESC closes the dialog */
  closeOnEsc?: boolean;
  /** Disable the close button (e.g. during save) */
  closeDisabled?: boolean;
  children: ReactNode;
  /** Optional footer content (action buttons) */
  footer?: ReactNode;
  /** Optional left-side footer content (e.g. delete button) */
  footerLeft?: ReactNode;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export function Dialog({
  isOpen,
  onClose,
  title,
  titleIcon,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  closeDisabled = false,
  children,
  footer,
  footerLeft,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeOnEscRef = useRef(closeOnEsc);
  const closeDisabledRef = useRef(closeDisabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscRef.current = closeOnEsc;
    closeDisabledRef.current = closeDisabled;
  }, [onClose, closeOnEsc, closeDisabled]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && closeOnEscRef.current && !closeDisabledRef.current) {
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus first focusable element in dialog
    requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasFooter = footer || footerLeft;
  const isScrollable = size === 'lg' || size === 'xl';

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={closeOnOverlayClick && !closeDisabled ? onClose : undefined}
    >
      <div className="flex min-h-full items-start justify-center py-4">
        <div
          ref={dialogRef}
          className={clsx(
            'w-full rounded-lg bg-white shadow-xl animate-scale-in',
            sizeClasses[size],
            isScrollable && 'flex max-h-[calc(100vh-2rem)] flex-col',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={clsx(
              'flex items-center justify-between border-b border-spa-bg-secondary p-6',
              isScrollable && 'rounded-t-lg bg-white',
            )}
          >
            <div className="flex items-center gap-3">
              {titleIcon}
              <h2
                id="dialog-title"
                className="text-xl font-bold text-spa-text-primary"
              >
                {title}
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={closeDisabled}
              className="rounded-lg p-2 transition-colors hover:bg-spa-bg-primary disabled:opacity-50"
              aria-label="Schließen"
            >
              <X className="h-5 w-5 text-spa-text-secondary" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div
            className={clsx(
              'p-6',
              isScrollable && 'flex-1 overflow-y-auto',
            )}
          >
            {children}
          </div>

          {/* Footer */}
          {hasFooter && (
            <div
              className={clsx(
                'flex items-center border-t border-spa-bg-secondary p-6',
                footerLeft ? 'justify-between' : 'justify-end',
                isScrollable && 'rounded-b-lg bg-white',
              )}
            >
              {footerLeft && <div>{footerLeft}</div>}
              <div className="flex items-center gap-2">{footer}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
