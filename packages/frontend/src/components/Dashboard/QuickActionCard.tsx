import { Link } from 'react-router-dom';
import { LucideIcon, ArrowRight } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color?: string;
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color = 'spa-primary',
}: QuickActionCardProps) {
  return (
    <Link
      to={href}
      className="block bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary hover:shadow-md hover:border-spa-primary/30 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 bg-${color}/10 rounded-lg group-hover:bg-${color}/20 transition-colors`}>
          <Icon className={`w-6 h-6 text-${color}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-spa-text-primary mb-1 group-hover:text-spa-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-spa-text-secondary">
            {description}
          </p>
        </div>
        <ArrowRight className="w-5 h-5 text-spa-text-secondary group-hover:text-spa-primary group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  );
}
