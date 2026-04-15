import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface SectionCardProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  noPadding,
}: SectionCardProps) {
  return (
    <section
      className={clsx(
        'overflow-hidden rounded-2xl border border-spa-bg-secondary/80 bg-spa-surface/95 shadow-xs backdrop-blur-xs',
        className,
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-spa-bg-secondary/80 bg-linear-to-r from-spa-surface via-spa-surface to-spa-bg-primary/5 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-spa-primary/10 text-spa-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-spa-text-primary">{title}</h3>
              {description && (
                <p className="text-sm text-spa-text-secondary mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={clsx(!noPadding && 'p-6')}>{children}</div>
    </section>
  );
}
