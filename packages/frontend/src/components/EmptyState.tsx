import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
      <Icon className="w-16 h-16 text-spa-text-secondary mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-spa-text-primary mb-2">
        {title}
      </h3>
      <p className="text-spa-text-secondary">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
