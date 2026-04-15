import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface DashboardWidgetFrameProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DashboardWidgetFrame({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
}: DashboardWidgetFrameProps) {
  return (
    <section
      className={clsx(
        'overflow-hidden rounded-2xl border border-spa-bg-secondary/80 bg-spa-surface/95 shadow-xs backdrop-blur-xs',
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-spa-bg-secondary/80 bg-linear-to-r from-spa-surface via-spa-surface to-spa-bg-primary/70 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {Icon && (
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spa-primary/10 text-spa-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-spa-text-primary">{title}</h3>
              {description && (
                <p className="mt-1 text-sm leading-relaxed text-spa-text-secondary">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        )}
      </div>

      <div className={clsx('p-6', contentClassName)}>{children}</div>
    </section>
  );
}
