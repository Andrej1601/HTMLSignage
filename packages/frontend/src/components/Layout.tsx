import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Settings, Monitor, Image, Flame, Presentation, Users, LogOut, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Aufgussplan', href: '/schedule', icon: Calendar },
    { name: 'Saunas', href: '/saunas', icon: Flame },
    { name: 'Slideshow', href: '/slideshow', icon: Presentation },
    { name: 'Geräte', href: '/devices', icon: Monitor },
    { name: 'Medien', href: '/media', icon: Image },
    { name: 'Einstellungen', href: '/settings', icon: Settings },
  ];

  // Add Users link for admins
  if (user?.roles.includes('admin')) {
    navigation.push({ name: 'Benutzer', href: '/users', icon: Users });
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-spa-bg-primary flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-spa-primary text-white">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo/Brand */}
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-spa-primary-dark">
            <h1 className="text-xl font-bold">HTMLSignage</h1>
          </div>

          {/* User Info */}
          {user && (
            <div className="px-4 py-3 bg-spa-primary-dark/50 border-b border-spa-primary-light">
              <div className="flex items-center">
                <div className="flex-shrink-0 h-10 w-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{user.username}</p>
                  <p className="text-xs text-white/70">{user.roles[0]}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={clsx(
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-spa-primary-dark text-white'
                      : 'text-white/90 hover:bg-spa-primary-light hover:text-white'
                  )}
                >
                  <Icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="flex-shrink-0 px-2 py-4 border-t border-spa-primary-light">
            <button
              onClick={handleLogout}
              className="group flex w-full items-center px-3 py-2 text-sm font-medium rounded-md text-white/90 hover:bg-spa-primary-light hover:text-white transition-colors"
            >
              <LogOut className="mr-3 flex-shrink-0 h-5 w-5" />
              Abmelden
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-16 px-4 bg-spa-primary text-white shadow-lg">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md hover:bg-spa-primary-light"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
        <h1 className="ml-4 text-xl font-bold">HTMLSignage</h1>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div
            className="fixed inset-y-0 left-0 w-64 bg-spa-primary text-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              {/* User Info */}
              {user && (
                <div className="px-4 py-6 bg-spa-primary-dark border-b border-spa-primary-light">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium">{user.username}</p>
                      <p className="text-xs text-white/70">{user.roles[0]}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={clsx(
                        'group flex items-center px-3 py-3 text-base font-medium rounded-md transition-colors',
                        isActive
                          ? 'bg-spa-primary-dark text-white'
                          : 'text-white/90 hover:bg-spa-primary-light hover:text-white'
                      )}
                    >
                      <Icon className="mr-3 flex-shrink-0 h-6 w-6" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Logout Button */}
              <div className="flex-shrink-0 px-2 py-4 border-t border-spa-primary-light">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="group flex w-full items-center px-3 py-3 text-base font-medium rounded-md text-white/90 hover:bg-spa-primary-light hover:text-white transition-colors"
                >
                  <LogOut className="mr-3 flex-shrink-0 h-6 w-6" />
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1 w-full">
        {/* Mobile top spacing */}
        <div className="lg:hidden h-16" />

        {/* Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
