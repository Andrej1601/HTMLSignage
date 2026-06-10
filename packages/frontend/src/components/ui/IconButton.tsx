import { forwardRef, type ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export type IconButtonVariant = 'ghost' | 'danger' | 'primary' | 'secondary';
export type IconButtonSize = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Accessible label — required because the button has no visible text. */
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost:
    'text-spa-text-secondary hover:bg-spa-bg-secondary hover:text-spa-text-primary focus-visible:ring-spa-primary',
  danger:
    'text-spa-error hover:bg-spa-error-light focus-visible:ring-spa-error',
  primary:
    'bg-spa-primary text-white hover:bg-spa-primary-dark focus-visible:ring-spa-primary',
  secondary:
    'text-spa-text-primary hover:bg-spa-bg-secondary focus-visible:ring-spa-secondary',
};

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'p-1.5',
  md: 'p-2',
};

const iconSizeClasses: Record<IconButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

/**
 * Icon-only button with a built-in `focus-visible` ring and a required
 * `aria-label`. Use instead of hand-rolling `<button>` wrappers around an icon
 * (which routinely shipped without keyboard focus styling or an accessible name).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      <Icon className={iconSizeClasses[size]} aria-hidden="true" />
    </button>
  );
});
