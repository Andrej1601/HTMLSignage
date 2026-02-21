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
    iconBg: 'bg-green-100',
    iconBgHover: 'group-hover:bg-green-200',
    iconFg: 'text-green-700',
    titleHover: 'group-hover:text-green-700',
    borderHover: 'hover:border-green-300',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconBgHover: 'group-hover:bg-amber-200',
    iconFg: 'text-amber-700',
    titleHover: 'group-hover:text-amber-700',
    borderHover: 'hover:border-amber-300',
  },
  danger: {
    iconBg: 'bg-red-100',
    iconBgHover: 'group-hover:bg-red-200',
    iconFg: 'text-red-700',
    titleHover: 'group-hover:text-red-700',
    borderHover: 'hover:border-red-300',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconBgHover: 'group-hover:bg-blue-200',
    iconFg: 'text-blue-700',
    titleHover: 'group-hover:text-blue-700',
    borderHover: 'hover:border-blue-300',
  },
  neutral: {
    iconBg: 'bg-gray-100',
    iconBgHover: 'group-hover:bg-gray-200',
    iconFg: 'text-gray-700',
    titleHover: 'group-hover:text-gray-700',
    borderHover: 'hover:border-gray-300',
  },
  violet: {
    iconBg: 'bg-violet-100',
    iconBgHover: 'group-hover:bg-violet-200',
    iconFg: 'text-violet-700',
    titleHover: 'group-hover:text-violet-700',
    borderHover: 'hover:border-violet-300',
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
