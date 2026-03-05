import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';
}

const colorClasses: Record<NonNullable<QuickActionCardProps['color']>, {
  iconBg: string;
  iconBgHover: string;
  iconFg: string;
  titleHover: string;
  borderHover: string;
}> = {
  primary: {
    iconBg: 'bg-spa-primary/10',
    iconBgHover: 'group-hover:bg-spa-primary/20',
    iconFg: 'text-spa-primary',
    titleHover: 'group-hover:text-spa-primary',
    borderHover: 'hover:border-spa-primary/30',
  },
  success: {
    iconBg: 'bg-spa-success-light',
    iconBgHover: 'group-hover:bg-spa-success/20',
    iconFg: 'text-spa-success-dark',
    titleHover: 'group-hover:text-spa-success-dark',
    borderHover: 'hover:border-spa-success/30',
  },
  warning: {
    iconBg: 'bg-spa-warning-light',
    iconBgHover: 'group-hover:bg-spa-warning/20',
    iconFg: 'text-spa-warning-dark',
    titleHover: 'group-hover:text-spa-warning-dark',
    borderHover: 'hover:border-spa-warning/30',
  },
  danger: {
    iconBg: 'bg-spa-error-light',
    iconBgHover: 'group-hover:bg-spa-error/20',
    iconFg: 'text-spa-error-dark',
    titleHover: 'group-hover:text-spa-error-dark',
    borderHover: 'hover:border-spa-error/30',
  },
  info: {
    iconBg: 'bg-spa-info-light',
    iconBgHover: 'group-hover:bg-spa-info/20',
    iconFg: 'text-spa-info-dark',
    titleHover: 'group-hover:text-spa-info-dark',
    borderHover: 'hover:border-spa-info/30',
  },
  neutral: {
    iconBg: 'bg-spa-bg-secondary',
    iconBgHover: 'group-hover:bg-spa-bg-secondary/80',
    iconFg: 'text-spa-text-secondary',
    titleHover: 'group-hover:text-spa-text-primary',
    borderHover: 'hover:border-spa-bg-secondary',
  },
  violet: {
    iconBg: 'bg-spa-primary-light/20',
    iconBgHover: 'group-hover:bg-spa-primary-light/30',
    iconFg: 'text-spa-primary-dark',
    titleHover: 'group-hover:text-spa-primary-dark',
    borderHover: 'hover:border-spa-primary/30',
  },
};

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color = 'primary',
}: QuickActionCardProps) {
  const selectedColor = colorClasses[color];

  return (
    <Link
      to={href}
      className={clsx(
        'block bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary hover:shadow-md transition-all group',
        selectedColor.borderHover
      )}
    >
      <div className="flex items-start gap-4">
        <div className={clsx('p-3 rounded-lg transition-colors', selectedColor.iconBg, selectedColor.iconBgHover)}>
          <Icon className={clsx('w-6 h-6', selectedColor.iconFg)} />
        </div>
        <div className="flex-1">
          <h3 className={clsx('text-lg font-semibold text-spa-text-primary mb-1 transition-colors', selectedColor.titleHover)}>
            {title}
          </h3>
          <p className="text-sm text-spa-text-secondary">
            {description}
          </p>
        </div>
        <ArrowRight className={clsx('w-5 h-5 text-spa-text-secondary group-hover:translate-x-1 transition-all', selectedColor.titleHover)} />
      </div>
    </Link>
  );
}
