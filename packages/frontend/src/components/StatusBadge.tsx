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
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-700 border-gray-200',
};

const dotToneClasses: Record<StatusTone, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
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
