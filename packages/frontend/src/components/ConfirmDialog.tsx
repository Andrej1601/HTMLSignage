import { useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirmVariant =
    variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary';

  const icon = variant !== 'default' ? (
    <div className={`flex-shrink-0 p-2 rounded-full ${
      variant === 'danger' ? 'bg-spa-error-light' : 'bg-spa-warning-light'
    }`}>
      <AlertTriangle
        className={`w-5 h-5 ${variant === 'danger' ? 'text-spa-error' : 'text-spa-warning'}`}
        aria-hidden="true"
      />
    </div>
  ) : undefined;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      titleIcon={icon}
      size="sm"
      closeOnOverlayClick
      closeOnEsc
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-spa-text-secondary text-sm">{message}</p>
    </Dialog>
  );
}
