import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';

interface PageHeaderBadge {
  label: string;
  tone?: StatusTone;
  pulse?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  badges?: PageHeaderBadge[];
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  badges = [],
  className,
}: PageHeaderProps) {
  return (
    <section
      className={clsx(
        'mb-6 rounded-2xl border border-spa-bg-secondary bg-gradient-to-r from-white via-spa-bg-primary to-spa-secondary/10 p-5 shadow-sm',
        className
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-spa-primary/10 text-spa-primary">
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div>
              <h2 className="text-3xl font-bold text-spa-text-primary">{title}</h2>
              {description && (
                <p className="mt-1 text-spa-text-secondary">{description}</p>
              )}
            </div>
          </div>
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>

      {badges.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <StatusBadge
              key={badge.label}
              label={badge.label}
              tone={badge.tone || 'neutral'}
              pulse={Boolean(badge.pulse)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
