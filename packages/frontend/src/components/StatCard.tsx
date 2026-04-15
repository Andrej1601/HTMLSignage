import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface StatCardDetail {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'info' | 'neutral';
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  details?: StatCardDetail[];
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';
  href?: string;
  ctaLabel?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const toneTextClasses: Record<string, string> = {
  success: 'text-spa-success-dark',
  warning: 'text-spa-warning-dark',
  info: 'text-spa-info-dark',
  neutral: 'text-spa-text-secondary',
};

const colorClasses: Record<NonNullable<StatCardProps['color']>, { iconBg: string; iconFg: string }> = {
  primary: { iconBg: 'bg-spa-primary/10', iconFg: 'text-spa-primary' },
  success: { iconBg: 'bg-spa-success-light', iconFg: 'text-spa-success-dark' },
  warning: { iconBg: 'bg-spa-warning-light', iconFg: 'text-spa-warning-dark' },
  danger: { iconBg: 'bg-spa-error-light', iconFg: 'text-spa-error-dark' },
  info: { iconBg: 'bg-spa-info-light', iconFg: 'text-spa-info-dark' },
  neutral: { iconBg: 'bg-spa-bg-secondary', iconFg: 'text-spa-text-secondary' },
  violet: { iconBg: 'bg-spa-primary-light/20', iconFg: 'text-spa-primary-dark' },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  details,
  color = 'primary',
  href,
  ctaLabel,
  trend,
}: StatCardProps) {
  const selectedColor = colorClasses[color];
  const cardClasses = clsx(
    'rounded-2xl border border-spa-bg-secondary/80 bg-spa-surface/95 p-5 shadow-xs backdrop-blur-xs transition-all',
    href ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md'
  );
  const cardContent = (
    <div className="flex items-center gap-4">
      <div className={clsx('shrink-0 rounded-xl p-3', selectedColor.iconBg)}>
        <Icon className={clsx('h-6 w-6', selectedColor.iconFg)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
          {title}
        </p>
        <p className="text-2xl font-bold text-spa-text-primary">
          {value}
        </p>
        {description && (
          <p className="text-xs text-spa-text-secondary mt-0.5">
            {description}
          </p>
        )}
        {details && details.length > 0 && (
          <div className="space-y-0.5 mt-1">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <span className="text-spa-text-secondary">{d.label}</span>
                <span className={clsx('font-medium', toneTextClasses[d.tone || 'neutral'] || 'text-spa-text-primary')}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {trend && (
          <div className={clsx('text-sm font-medium mt-1', trend.isPositive ? 'text-spa-success-dark' : 'text-spa-error-dark')}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
        {href && (
          <div className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-spa-primary">
            {ctaLabel || 'Details'}
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className={cardClasses}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={cardClasses}>
      {cardContent}
    </div>
  );
}
