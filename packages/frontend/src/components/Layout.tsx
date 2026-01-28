import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Settings, Monitor, Image } from 'lucide-react';
import clsx from 'clsx';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Aufgussplan', href: '/schedule', icon: Calendar },
    { name: 'Geräte', href: '/devices', icon: Monitor },
    { name: 'Medien', href: '/media', icon: Image },
    { name: 'Einstellungen', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-spa-bg-primary">
      <nav className="bg-spa-primary text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">HTMLSignage</h1>
            </div>
            <div className="flex space-x-4">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={clsx(
                      'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors',
                      isActive
                        ? 'bg-spa-primary-dark'
                        : 'hover:bg-spa-primary-light'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
