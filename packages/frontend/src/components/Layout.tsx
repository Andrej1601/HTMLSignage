import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Settings, Monitor, Image, Flame, Presentation, Users, LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, type Permission } from '@/utils/permissions';
import { useEffect, useMemo, useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  section: 'operations' | 'content' | 'system';
  description: string;
}

interface NavSection {
  key: NavItem['section'];
  title: string;
  description: string;
  items: NavItem[];
}

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
    const roles = user?.roles ?? [];
    const allItems: NavItem[] = [
      {
        name: 'Dashboard',
        href: '/',
        icon: Home,
        section: 'operations',
        description: 'Live-Lage, Warnungen und Betriebsfokus.',
      },
      {
        name: 'Aufgussplan',
        href: '/schedule',
        icon: Calendar,
        permission: 'schedule:write',
        section: 'operations',
        description: 'Presets, Zeiten und Live-Automatik steuern.',
      },
      {
        name: 'Geräte',
        href: '/devices',
        icon: Monitor,
        permission: 'devices:manage',
        section: 'operations',
        description: 'Displays, Pairings und Ausspielmodi verwalten.',
      },
      {
        name: 'Slideshow',
        href: '/slideshow',
        icon: Presentation,
        permission: 'slideshow:manage',
        section: 'content',
        description: 'Slideshows, Varianten und Veröffentlichungen pflegen.',
      },
      {
        name: 'Medien',
        href: '/media',
        icon: Image,
        permission: 'media:manage',
        section: 'content',
        description: 'Bilder, Audio und Video zentral organisieren.',
      },
      {
        name: 'Saunen',
        href: '/saunas',
        icon: Flame,
        permission: 'saunas:read',
        section: 'content',
        description: 'Saunadaten und Anzeigeprofile bearbeiten.',
      },
      {
        name: 'Einstellungen',
        href: '/settings',
        icon: Settings,
        permission: 'settings:manage',
        section: 'system',
        description: 'Design, Audio, Events und Systempflege bündeln.',
      },
      {
        name: 'Benutzer',
        href: '/users',
        icon: Users,
        permission: 'users:manage',
        section: 'system',
        description: 'Rollen, Zugriff und Verantwortlichkeiten steuern.',
      },
    ];

    return allItems.filter((item) => !item.permission || hasPermission(roles, item.permission));
  }, [user?.roles]);

  const navigationSections = useMemo<NavSection[]>(() => {
    const sectionMeta: Omit<NavSection, 'items'>[] = [
      {
        key: 'operations',
        title: 'Betrieb',
        description: 'Live-Steuerung und laufender Betrieb.',
      },
      {
        key: 'content',
        title: 'Inhalte',
        description: 'Slides, Medien und Domänendaten.',
      },
      {
        key: 'system',
        title: 'System',
        description: 'Konfiguration, Benutzer und Wartung.',
      },
    ];

    return sectionMeta
      .map((section) => ({
        ...section,
        items: navigation.filter((item) => item.section === section.key),
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
    <div className="min-h-screen bg-gradient-to-br from-spa-bg-primary via-white to-spa-bg-primary/80 flex">
      {/* Skip-to-Content for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-spa-primary focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Zum Hauptinhalt springen
      </a>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:w-72 lg:flex-col bg-gradient-to-b from-spa-primary to-spa-primary-dark text-white shadow-2xl">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Logo/Brand */}
          <div className="flex h-24 flex-shrink-0 flex-col justify-center border-b border-white/10 px-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Control Center
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight">HTMLSignage</h1>
            <p className="mt-1 text-xs text-white/70">
              Displays, Inhalte und Systembetrieb in einem Blick.
            </p>
          </div>

          {/* User Info */}
          {user && (
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 font-bold">
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
          <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Hauptnavigation">
            <div className="space-y-5">
              {navigationSections.map((section) => (
                <div key={section.key} className="space-y-1.5">
                  <div className="px-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      {section.title}
                    </p>
                    <p className="mt-1 text-xs text-white/55">{section.description}</p>
                  </div>

                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isRouteActive(location.pathname, item.href);
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={clsx(
                          'group flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                          isActive
                            ? 'border-white bg-white text-spa-primary shadow-sm'
                            : 'border-transparent text-white/90 hover:border-white/20 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon
                            className={clsx(
                              'h-5 w-5',
                              isActive ? 'text-spa-primary' : 'text-white/80 group-hover:text-white',
                            )}
                          />
                          {item.name}
                        </span>
                        <span
                          className={clsx(
                            'h-2 w-2 rounded-full transition-colors',
                            isActive ? 'bg-spa-primary' : 'bg-transparent group-hover:bg-white/50',
                          )}
                        />
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>

          {/* Logout Button */}
          <div className="flex-shrink-0 border-t border-white/10 px-2 py-4">
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
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-16 items-center border-b border-white/10 bg-spa-primary text-white shadow-lg">
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
            <p className="mt-0.5 text-[11px] text-white/80">{activeNavigation.name}</p>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" role="presentation" onClick={() => setIsMobileMenuOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); }}>
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
              <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Hauptnavigation">
                <div className="space-y-5">
                  {navigationSections.map((section) => (
                    <div key={section.key} className="space-y-1.5">
                      <div className="px-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                          {section.title}
                        </p>
                        <p className="mt-1 text-xs text-white/60">{section.description}</p>
                      </div>

                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = isRouteActive(location.pathname, item.href);
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            aria-current={isActive ? 'page' : undefined}
                            className={clsx(
                              'group flex items-center rounded-xl px-3 py-3 text-base font-medium transition-colors',
                              isActive
                                ? 'bg-spa-primary-dark text-white'
                                : 'text-white/90 hover:bg-spa-primary-light hover:text-white',
                            )}
                          >
                            <Icon className="mr-3 h-6 w-6 flex-shrink-0" />
                            <div className="min-w-0">
                              <p>{item.name}</p>
                              <p className="mt-0.5 text-xs text-white/65">{item.description}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
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
      <div className="flex w-full flex-1 flex-col lg:pl-72">
        {/* Mobile top spacing */}
        <div className="lg:hidden h-16" />

        {/* Content */}
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
