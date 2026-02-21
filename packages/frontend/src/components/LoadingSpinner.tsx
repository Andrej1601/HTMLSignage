import clsx from 'clsx';

interface LoadingSpinnerProps {
  /** Text shown below the spinner */
  label?: string;
  /** Full-page centered layout (default) or inline */
  variant?: 'page' | 'inline';
  /** Additional classes */
  className?: string;
}

export function LoadingSpinner({ label, variant = 'page', className }: LoadingSpinnerProps) {
  const spinner = (
    <div className={clsx('flex flex-col items-center gap-3', className)}>
      <div
        className="w-8 h-8 border-[3px] border-spa-bg-secondary border-t-spa-primary rounded-full animate-spin"
        role="status"
        aria-label={label || 'Lädt'}
      />
      {label && <p className="text-sm text-spa-text-secondary">{label}</p>}
    </div>
  );

  if (variant === 'inline') return spinner;

  return (
    <div className="flex items-center justify-center h-96">
      {spinner}
    </div>
  );
}
