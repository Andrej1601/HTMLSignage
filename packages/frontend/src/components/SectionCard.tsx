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
    <div className={clsx('bg-white rounded-lg shadow-sm border border-spa-bg-secondary', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-spa-bg-secondary">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-5 h-5 text-spa-text-secondary flex-shrink-0" />}
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-spa-text-primary">{title}</h3>
              {description && (
                <p className="text-sm text-spa-text-secondary mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      <div className={clsx(!noPadding && 'p-6')}>{children}</div>
    </div>
  );
}
