import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'warning' | 'active';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-spa-primary text-white hover:bg-spa-primary-dark focus-visible:ring-spa-primary',
  secondary:
    'bg-spa-bg-secondary text-spa-text-primary hover:bg-spa-secondary/20 focus-visible:ring-spa-secondary',
  danger:
    'bg-spa-error text-white hover:bg-spa-error-dark focus-visible:ring-spa-error',
  warning:
    'bg-spa-warning text-white hover:bg-spa-warning-dark focus-visible:ring-spa-warning',
  ghost:
    'bg-transparent text-spa-text-secondary hover:bg-spa-bg-secondary hover:text-spa-text-primary focus-visible:ring-spa-primary',
  active:
    'bg-spa-secondary text-white hover:bg-spa-secondary-dark focus-visible:ring-spa-secondary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    loadingText,
    fullWidth = false,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          className={clsx(
            'border-2 border-current border-t-transparent rounded-full animate-spin',
            iconSizeClasses[size],
          )}
          aria-hidden="true"
        />
      )}
      {!loading && Icon && (
        <Icon className={iconSizeClasses[size]} aria-hidden="true" />
      )}
      {loading && loadingText ? loadingText : children}
      {!loading && IconRight && (
        <IconRight className={iconSizeClasses[size]} aria-hidden="true" />
      )}
    </button>
  );
});
