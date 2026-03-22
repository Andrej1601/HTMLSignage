import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/schedule': 'Aufgussplan',
  '/devices': 'Geräte',
  '/slideshow': 'Slideshow',
  '/media': 'Medien',
  '/saunas': 'Saunen',
  '/settings': 'Einstellungen',
  '/users': 'Benutzer',
};

export function Breadcrumbs() {
  const { pathname } = useLocation();

  if (pathname === '/') return null;

  const label = ROUTE_LABELS[pathname];
  if (!label) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm text-spa-text-secondary">
        <li>
          <Link
            to="/"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-spa-bg-secondary hover:text-spa-text-primary transition-colors"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>
        </li>
        <li aria-hidden="true">
          <ChevronRight className="h-3.5 w-3.5 text-spa-text-secondary/50" />
        </li>
        <li>
          <span className="px-1.5 py-0.5 font-medium text-spa-text-primary" aria-current="page">
            {label}
          </span>
        </li>
      </ol>
    </nav>
  );
}
