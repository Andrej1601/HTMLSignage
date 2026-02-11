import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  color?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'spa-primary',
  trend,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary hover:shadow-md transition-shadow">
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
            <div className={`text-sm font-medium mt-2 ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        <div className={`p-3 bg-${color}/10 rounded-lg`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
      </div>
    </div>
  );
}
