import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Settings, Monitor, Image, Flame, Presentation, Users, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';

type NavSectionKey = 'operations' | 'content' | 'admin';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  section: NavSectionKey;
}

const SECTION_ORDER: NavSectionKey[] = ['operations', 'content', 'admin'];

const SECTION_LABELS: Record<NavSectionKey, string> = {
  operations: 'Betrieb',
  content: 'Inhalte',
  admin: 'Administration',
};

function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { name: 'Dashboard', href: '/', icon: Home, section: 'operations' },
      { name: 'Aufgussplan', href: '/schedule', icon: Calendar, section: 'operations' },
      { name: 'Geräte', href: '/devices', icon: Monitor, section: 'operations' },
      { name: 'Slideshow', href: '/slideshow', icon: Presentation, section: 'content' },
      { name: 'Medien', href: '/media', icon: Image, section: 'content' },
      { name: 'Saunas', href: '/saunas', icon: Flame, section: 'content' },
      { name: 'Einstellungen', href: '/settings', icon: Settings, section: 'admin' },
    ];

    if (user?.roles.includes('admin')) {
      items.push({ name: 'Benutzer', href: '/users', icon: Users, section: 'admin' });
    }

    return items;
  }, [user?.roles]);

  const navigationSections = useMemo(() => {
    return SECTION_ORDER
      .map((section) => ({
        key: section,
        label: SECTION_LABELS[section],
        items: navigation.filter((item) => item.section === section),
      }))
      .filter((section) => section.items.length > 0);
  }, [navigation]);

  const activeNavigation = useMemo(() => {
    return navigation.find((item) => isRouteActive(location.pathname, item.href)) || null;
  }, [navigation, location.pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-spa-bg-primary flex">
      {/* Skip-to-Content for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-spa-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Zum Hauptinhalt springen
      </a>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-gradient-to-b from-spa-primary to-spa-primary-dark text-white shadow-2xl">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo/Brand */}
          <div className="flex h-20 flex-shrink-0 flex-col justify-center px-5 border-b border-white/10">
            <h1 className="text-xl font-bold tracking-tight">HTMLSignage</h1>
            <p className="text-xs text-white/70 mt-1">Control Center</p>
          </div>

          {/* User Info */}
          {user && (
            <div className="px-4 py-3 border-b border-white/10">
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
          <nav className="flex-1 px-2 py-4 overflow-y-auto space-y-4" aria-label="Hauptnavigation">
            {navigationSections.map((section) => (
              <div key={section.key} className="space-y-1">
                <p className="px-3 text-[11px] uppercase tracking-[0.14em] text-white/60">
                  {section.label}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isRouteActive(location.pathname, item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={clsx(
                        'group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl border transition-all',
                        isActive
                          ? 'bg-white text-spa-primary border-white shadow-sm'
                          : 'border-transparent text-white/90 hover:bg-white/10 hover:border-white/20 hover:text-white'
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={clsx('h-5 w-5', isActive ? 'text-spa-primary' : 'text-white/80 group-hover:text-white')} />
                        {item.name}
                      </span>
                      <span className={clsx('h-2 w-2 rounded-full transition-colors', isActive ? 'bg-spa-primary' : 'bg-transparent group-hover:bg-white/50')} />
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Logout Button */}
          <div className="flex-shrink-0 px-2 py-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="group flex w-full items-center px-3 py-2.5 text-sm font-medium rounded-xl text-white/90 hover:bg-white/10 hover:text-white transition-colors"
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
          aria-label={isMobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
        <div className="ml-4">
          <h1 className="text-xl font-bold">HTMLSignage</h1>
          {activeNavigation && (
            <p className="text-[11px] text-white/80 mt-0.5">{activeNavigation.name}</p>
          )}
        </div>
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
              <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto" aria-label="Hauptnavigation">
                {navigationSections.map((section) => (
                  <div key={section.key} className="space-y-1">
                    <p className="px-3 text-[11px] uppercase tracking-[0.14em] text-white/60">
                      {section.label}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = isRouteActive(location.pathname, item.href);
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
                  </div>
                ))}
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
      <div className="lg:pl-72 flex flex-col flex-1 w-full">
        {/* Mobile top spacing */}
        <div className="lg:hidden h-16" />

        {/* Content */}
        <main id="main-content" className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
