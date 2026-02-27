import { useEffect, useRef, useCallback, type ReactNode } from 'react';
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

  // Trap focus and manage ESC
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc && !closeDisabled) {
        onClose();
        return;
      }

      // Focus trap
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
    },
    [closeOnEsc, closeDisabled, onClose],
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

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
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const hasFooter = footer || footerLeft;
  const isScrollable = size === 'lg' || size === 'xl';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      onClick={closeOnOverlayClick && !closeDisabled ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        className={clsx(
          'bg-white rounded-lg shadow-xl w-full',
          sizeClasses[size],
          isScrollable && 'max-h-[90vh] flex flex-col',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={clsx(
            'flex items-center justify-between p-6 border-b border-spa-bg-secondary',
            isScrollable && 'sticky top-0 bg-white z-10 rounded-t-lg',
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
            className="p-2 hover:bg-spa-bg-primary rounded-lg transition-colors disabled:opacity-50"
            aria-label="Schließen"
          >
            <X className="w-5 h-5 text-spa-text-secondary" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div
          className={clsx(
            'p-6',
            isScrollable && 'overflow-y-auto flex-1',
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {hasFooter && (
          <div
            className={clsx(
              'flex items-center p-6 border-t border-spa-bg-secondary',
              footerLeft ? 'justify-between' : 'justify-end',
              isScrollable && 'sticky bottom-0 bg-white z-10 rounded-b-lg',
            )}
          >
            {footerLeft && <div>{footerLeft}</div>}
            <div className="flex items-center gap-2">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
