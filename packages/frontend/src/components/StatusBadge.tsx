import clsx from 'clsx';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  pulse?: boolean;
  showDot?: boolean;
  className?: string;
}

const toneClasses: Record<StatusTone, string> = {
  success: 'bg-spa-success-light text-spa-success-dark border-spa-success/30',
  warning: 'bg-spa-warning-light text-spa-warning-dark border-spa-warning/30',
  danger: 'bg-spa-error-light text-spa-error-dark border-spa-error/30',
  info: 'bg-spa-info-light text-spa-info-dark border-spa-info/30',
  neutral: 'bg-spa-bg-secondary text-spa-text-secondary border-spa-bg-secondary',
};

const dotToneClasses: Record<StatusTone, string> = {
  success: 'bg-spa-success',
  warning: 'bg-spa-warning',
  danger: 'bg-spa-error',
  info: 'bg-spa-info',
  neutral: 'bg-spa-text-secondary',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  pulse = false,
  showDot = true,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        toneClasses[tone],
        className
      )}
    >
      {showDot && (
        <span
          aria-hidden="true"
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            dotToneClasses[tone],
            pulse && 'animate-pulse'
          )}
        />
      )}
      {label}
    </span>
  );
}
