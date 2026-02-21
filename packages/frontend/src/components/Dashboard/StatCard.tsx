import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';
  href?: string;
  ctaLabel?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const colorClasses: Record<NonNullable<StatCardProps['color']>, { iconBg: string; iconFg: string }> = {
  primary: { iconBg: 'bg-spa-primary/10', iconFg: 'text-spa-primary' },
  success: { iconBg: 'bg-green-100', iconFg: 'text-green-600' },
  warning: { iconBg: 'bg-amber-100', iconFg: 'text-amber-700' },
  danger: { iconBg: 'bg-red-100', iconFg: 'text-red-600' },
  info: { iconBg: 'bg-blue-100', iconFg: 'text-blue-600' },
  neutral: { iconBg: 'bg-gray-100', iconFg: 'text-gray-600' },
  violet: { iconBg: 'bg-violet-100', iconFg: 'text-violet-600' },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'primary',
  href,
  ctaLabel,
  trend,
}: StatCardProps) {
  const selectedColor = colorClasses[color];
  const cardClasses = clsx(
    'bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary transition-all',
    href ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'hover:shadow-md'
  );
  const cardContent = (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-spa-text-secondary mb-1">
          {title}
        </p>
        <p className="text-3xl font-bold text-spa-text-primary mb-2">
          {value}
        </p>
        {description && (
          <p className="text-sm text-spa-text-secondary">
            {description}
          </p>
        )}
        {trend && (
          <div className={clsx('text-sm font-medium mt-2', trend.isPositive ? 'text-green-600' : 'text-red-600')}>
            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </div>
        )}
        {href && (
          <div className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-spa-primary">
            {ctaLabel || 'Details'}
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className={clsx('p-3 rounded-lg', selectedColor.iconBg)}>
        <Icon className={clsx('w-6 h-6', selectedColor.iconFg)} />
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
