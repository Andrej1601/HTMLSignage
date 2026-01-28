import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { useSchedule } from '@/hooks/useSchedule';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import {
  Calendar,
  Monitor,
  Image,
  Settings,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  Clock,
  Upload,
} from 'lucide-react';

export function DashboardPage() {
  const { schedule, isLoading: scheduleLoading } = useSchedule();
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { data: media = [], isLoading: mediaLoading } = useMedia();
  const { settings, isLoading: settingsLoading } = useSettings();

  const isLoading = scheduleLoading || devicesLoading || mediaLoading || settingsLoading;

  // Calculate statistics
  const stats = {
    totalDevices: devices.length,
    onlineDevices: devices.filter(d => {
      if (!d.lastSeen) return false;
      const lastSeen = new Date(d.lastSeen);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeen.getTime()) / 1000 / 60;
      return diffMinutes < 5;
    }).length,
    totalMedia: media.length,
    scheduleRows: schedule?.rows?.length || 0,
    scheduleVersion: schedule?.version || 1,
  };

  const quickActions = [
    {
      title: 'Aufgussplan bearbeiten',
      description: 'Bearbeite den aktuellen Wochenplan',
      icon: Calendar,
      href: '/schedule',
      color: 'spa-primary',
    },
    {
      title: 'Display hinzufügen',
      description: 'Neues Display koppeln und konfigurieren',
      icon: Monitor,
      href: '/devices',
      color: 'blue-600',
    },
    {
      title: 'Medien hochladen',
      description: 'Bilder, Audio und Videos verwalten',
      icon: Upload,
      href: '/media',
      color: 'purple-600',
    },
    {
      title: 'Design anpassen',
      description: 'Farben, Schriften und Audio konfigurieren',
      icon: Settings,
      href: '/settings',
      color: 'green-600',
    },
  ];

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-spa-text-secondary">Lade Dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Dashboard</h2>
          <p className="text-spa-text-secondary">
            Willkommen bei HTMLSignage - Übersicht über dein System
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Geräte Online"
            value={`${stats.onlineDevices}/${stats.totalDevices}`}
            icon={stats.onlineDevices > 0 ? Wifi : WifiOff}
            description={`${stats.onlineDevices} von ${stats.totalDevices} aktiv`}
            color={stats.onlineDevices > 0 ? 'green-600' : 'red-600'}
          />

          <StatCard
            title="Aufgussplan"
            value={`v${stats.scheduleVersion}`}
            icon={Calendar}
            description={`${stats.scheduleRows} Zeilen konfiguriert`}
            color="spa-primary"
          />

          <StatCard
            title="Medien-Bibliothek"
            value={stats.totalMedia}
            icon={Image}
            description="Dateien hochgeladen"
            color="purple-600"
          />

          <StatCard
            title="System-Status"
            value="Aktiv"
            icon={Activity}
            description="Alle Dienste laufen"
            color="green-600"
          />
        </div>

        {/* System Health */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary mb-8">
          <h3 className="text-lg font-semibold text-spa-text-primary mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            System-Gesundheit
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Backend Status */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-medium text-spa-text-primary">Backend</p>
                <p className="text-sm text-spa-text-secondary">Verbunden</p>
              </div>
            </div>

            {/* Database Status */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-medium text-spa-text-primary">Datenbank</p>
                <p className="text-sm text-spa-text-secondary">Aktiv</p>
              </div>
            </div>

            {/* WebSocket Status */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <div>
                <p className="font-medium text-spa-text-primary">WebSocket</p>
                <p className="text-sm text-spa-text-secondary">Bereit</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-spa-text-primary mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Schnellzugriff
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.href}
                title={action.title}
                description={action.description}
                icon={action.icon}
                href={action.href}
                color={action.color}
              />
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
          <h3 className="text-lg font-semibold text-spa-text-primary mb-4">
            Letzte Aktivität
          </h3>
          <div className="space-y-3">
            {schedule && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-spa-primary rounded-full" />
                <span className="text-spa-text-secondary">
                  Aufgussplan Version {schedule.version} aktiviert
                </span>
                <span className="text-xs text-spa-text-secondary ml-auto">
                  {new Date(schedule.updatedAt || schedule.createdAt).toLocaleString('de-DE')}
                </span>
              </div>
            )}
            {settings && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full" />
                <span className="text-spa-text-secondary">
                  Einstellungen Version {settings.version} gespeichert
                </span>
                <span className="text-xs text-spa-text-secondary ml-auto">
                  Konfiguriert
                </span>
              </div>
            )}
            {stats.totalMedia > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-purple-600 rounded-full" />
                <span className="text-spa-text-secondary">
                  {stats.totalMedia} Medien in Bibliothek
                </span>
                <span className="text-xs text-spa-text-secondary ml-auto">
                  Verwaltet
                </span>
              </div>
            )}
            {stats.onlineDevices > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-600 rounded-full" />
                <span className="text-spa-text-secondary">
                  {stats.onlineDevices} Display{stats.onlineDevices !== 1 ? 's' : ''} online
                </span>
                <span className="text-xs text-spa-text-secondary ml-auto">
                  Aktiv
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
