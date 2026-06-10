import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface SegmentOption<T extends string> {
  value: T;
  /** Visible text label. Omit for icon-only segments (then provide `ariaLabel`). */
  label?: string;
  /** Optional leading icon. */
  icon?: LucideIcon;
  /** Accessible label — required when there is no visible `label` (icon-only segment). */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the whole control (the radiogroup). */
  ariaLabel: string;
  className?: string;
}

/**
 * Accessible segmented / toggle control. Renders a `radiogroup` of `radio`
 * buttons with a built-in `focus-visible` ring, replacing the hand-rolled pill
 * groups that previously lacked keyboard focus styling and ARIA semantics.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        'flex items-center gap-1 rounded-lg border border-spa-bg-secondary bg-spa-surface p-1',
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label ? undefined : option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex items-center justify-center gap-1.5 rounded-md p-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-spa-primary',
              isActive
                ? 'bg-spa-primary text-white'
                : 'text-spa-text-secondary hover:bg-spa-bg-primary',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
