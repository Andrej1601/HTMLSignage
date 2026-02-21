import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { LiveOperationsWidget } from '@/components/Dashboard/LiveOperationsWidget';
import { ContentQualityWidget } from '@/components/Dashboard/ContentQualityWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaInsightsWidget } from '@/components/Dashboard/MediaInsightsWidget';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useWidgetVisibility, WIDGET_PREFERENCES } from '@/hooks/useWidgetVisibility';
import { useDashboardData } from '@/hooks/useDashboardData';
import { PRESET_LABELS } from '@/types/schedule.types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Calendar,
  Monitor,
  Settings,
  Wifi,
  WifiOff,
  TrendingUp,
  Upload,
  AlertCircle,
  CheckCircle,
  Play,
  SlidersHorizontal,
  LayoutDashboard,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const widgetStorageKey = `htmlsignage_dashboard_widgets_${user?.id || 'anonymous'}`;
  const {
    widgetVisibility,
    isWidgetPanelOpen,
    setIsWidgetPanelOpen,
    activeWidgetCount,
    toggleWidget,
    showAllWidgets,
    setOpsFocus,
  } = useWidgetVisibility(widgetStorageKey);

  const {
    isLoading,
    scheduleQuery, settingsQuery, devicesQuery, mediaQuery, backendHealthQuery,
    schedule, wsConnected,
    isAdmin,
    liveState, planQuality, mediaStats, eventStats,
    runningSlideshows, systemChecks, updateLabel,
    activityItems,
  } = useDashboardData();

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Dashboard..." />
      </Layout>
    );
  }

  const livePresetLabel = liveState.activePreset ? PRESET_LABELS[liveState.activePreset] : '-';
  const planQualityTone: StatusTone =
    (planQuality.inconsistentRows > 0 || planQuality.duplicateTimeRows > 0) ? 'danger'
    : planQuality.emptyRows > 0 ? 'warning'
    : 'success';

  const hasLeftWidgets =
    widgetVisibility.liveOperations || widgetVisibility.contentQuality || widgetVisibility.activityFeed;
  const hasRightWidgets =
    widgetVisibility.systemChecks || widgetVisibility.mediaInsights || widgetVisibility.quickActions;

  const quickActions = [
    { title: 'Aufgussplan bearbeiten', description: 'Wochenplan pflegen und Event-Presets verwalten', icon: Calendar, href: '/schedule', color: 'primary' as const },
    { title: 'Gerätestatus', description: 'Offline-Displays, Pairings und Modi prüfen', icon: Monitor, href: '/devices', color: 'info' as const },
    { title: 'Medien aktualisieren', description: 'Bilder, Audio und Video hochladen', icon: Upload, href: '/media', color: 'violet' as const },
    { title: 'Systemwartung', description: 'Update-Status, Backup-Import und Export', icon: Settings, href: '/settings', color: 'success' as const },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Status Banner */}
        <div className="rounded-xl bg-gradient-to-r from-spa-primary/10 to-spa-secondary/15 border border-spa-bg-secondary p-6">
          <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Dashboard</h2>
          <p className="text-spa-text-secondary">Betriebszentrale für Displays, Inhalte und Systemzustand</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge
              label={wsConnected ? 'WebSocket verbunden' : 'WebSocket getrennt'}
              tone={systemChecks.websocketTone}
              pulse={wsConnected}
            />
            <StatusBadge
              label={backendHealthQuery.data?.status === 'ok' ? 'Backend erreichbar' : 'Backend prüfen'}
              tone={systemChecks.backendTone}
            />
            <StatusBadge
              label={liveState.activeEvent ? `Event live: ${liveState.activeEvent.name}` : 'Kein Event aktiv'}
              tone={liveState.activeEvent ? 'info' : 'neutral'}
              showDot={Boolean(liveState.activeEvent)}
            />
            <StatusBadge
              label={schedule?.autoPlay ? 'Auto-Play aktiv' : 'Manueller Planmodus'}
              tone={schedule?.autoPlay ? 'success' : 'warning'}
            />
          </div>
        </div>

        {/* Widget Layout Panel */}
        <div className="bg-white rounded-lg shadow-sm p-5 border border-spa-bg-secondary">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-spa-text-primary flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5" />
                Widget-Layout
              </h3>
              <p className="text-sm text-spa-text-secondary mt-1">
                {activeWidgetCount} von {WIDGET_PREFERENCES.length} Widgets sichtbar
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsWidgetPanelOpen((p) => !p)}
                className="px-3 py-2 text-sm bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors inline-flex items-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {isWidgetPanelOpen ? 'Anpassung schließen' : 'Widgets anpassen'}
              </button>
              <button
                onClick={setOpsFocus}
                className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Ops-Fokus
              </button>
              <button
                onClick={showAllWidgets}
                className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                Alle anzeigen
              </button>
            </div>
          </div>
          {isWidgetPanelOpen && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {WIDGET_PREFERENCES.map((widget) => {
                const isEnabled = widgetVisibility[widget.key];
                return (
                  <button
                    key={widget.key}
                    onClick={() => toggleWidget(widget.key)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      isEnabled
                        ? 'border-spa-primary/40 bg-spa-primary/5'
                        : 'border-spa-bg-secondary bg-white hover:border-spa-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-spa-text-primary">{widget.title}</p>
                      <StatusBadge label={isEnabled ? 'An' : 'Aus'} tone={isEnabled ? 'success' : 'neutral'} showDot={false} />
                    </div>
                    <p className="text-xs text-spa-text-secondary mt-1">{widget.description}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            title="Live-Betrieb"
            value={`${liveState.onlineDevices}/${liveState.pairedDevices.length}`}
            icon={liveState.onlineDevices > 0 ? Wifi : WifiOff}
            description={`${liveState.offlineDevices} offline · ${liveState.pendingPairings} pending`}
            color={liveState.offlineDevices > 0 ? 'warning' : 'success'}
            href="/devices"
            ctaLabel="Zu Geräten"
          />
          <StatCard
            title="Aktiver Plan"
            value={livePresetLabel}
            icon={Play}
            description={liveState.activeEvent ? `Event: ${liveState.activeEvent.name}` : 'Regulärer Tagesplan'}
            color={liveState.activeEvent ? 'info' : 'primary'}
            href="/schedule"
            ctaLabel="Zum Aufgussplan"
          />
          <StatCard
            title="Planqualität"
            value={`${planQuality.fillRate}%`}
            icon={TrendingUp}
            description={`${planQuality.emptyRows} leere Zeilen · ${planQuality.inconsistentRows + planQuality.duplicateTimeRows} Konflikte`}
            color={planQualityTone === 'danger' ? 'danger' : planQualityTone === 'warning' ? 'warning' : 'success'}
            href="/schedule"
            ctaLabel="Checks öffnen"
          />
          <StatCard
            title="Event-Setup"
            value={`${eventStats.enabled}/${eventStats.total}`}
            icon={Calendar}
            description={eventStats.activeName ? `Aktiv: ${eventStats.activeName}` : 'Kein Event aktiv'}
            color={eventStats.activeName ? 'info' : eventStats.enabled > 0 ? 'primary' : 'neutral'}
            href="/settings"
            ctaLabel="Zu Einstellungen"
          />
        </div>

        {activeWidgetCount === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>Alle Widgets sind ausgeblendet. Aktiviere mindestens ein Widget für das Dashboard.</span>
            <button
              onClick={showAllWidgets}
              className="px-3 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium transition-colors"
            >
              Widgets zurücksetzen
            </button>
          </div>
        )}

        {/* Widget Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {widgetVisibility.liveOperations && (
              <LiveOperationsWidget liveState={liveState} runningSlideshows={runningSlideshows} />
            )}
            {widgetVisibility.contentQuality && (
              <ContentQualityWidget
                livePresetLabel={livePresetLabel}
                autoPlay={schedule?.autoPlay || false}
                activeEventName={liveState.activeEvent?.name || null}
                planQuality={planQuality}
              />
            )}
            {widgetVisibility.activityFeed && <ActivityFeedWidget items={activityItems} />}
            {!hasLeftWidgets && (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
                <p className="text-sm text-spa-text-secondary">
                  Im linken Bereich sind aktuell keine Widgets sichtbar. Aktiviere Widgets über "Widgets anpassen".
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {widgetVisibility.systemChecks && (
              <SystemChecksWidget
                backendStatus={
                  backendHealthQuery.data?.status === 'ok' ? 'ok'
                  : backendHealthQuery.isError ? 'error'
                  : 'unknown'
                }
                backendTone={systemChecks.backendTone}
                dataTone={systemChecks.dataTone}
                websocketTone={systemChecks.websocketTone}
                wsConnected={wsConnected}
                updateTone={systemChecks.updateTone}
                isAdmin={isAdmin}
                updateLabel={updateLabel}
              />
            )}
            {widgetVisibility.mediaInsights && (
              <MediaInsightsWidget
                images={mediaStats.images}
                audio={mediaStats.audio}
                videos={mediaStats.videos}
                totalSize={mediaStats.totalSize}
                latestMediaName={mediaStats.latestMedia?.originalName || null}
                latestMediaDate={
                  mediaStats.latestMedia ? new Date(mediaStats.latestMedia.createdAt) : null
                }
              />
            )}
            {widgetVisibility.quickActions && (
              <div>
                <h3 className="text-lg font-semibold text-spa-text-primary mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Schnellzugriff
                </h3>
                <div className="space-y-3">
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
            )}
            {!hasRightWidgets && (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
                <p className="text-sm text-spa-text-secondary">
                  Im rechten Bereich sind aktuell keine Widgets sichtbar. Aktiviere Widgets über "Widgets anpassen".
                </p>
              </div>
            )}
          </div>
        </div>

        {(scheduleQuery.error || settingsQuery.error || devicesQuery.error || mediaQuery.error || backendHealthQuery.error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Ein oder mehrere Datenquellen konnten nicht geladen werden. Bitte API- und Netzwerkstatus prüfen.
          </div>
        )}
      </div>
    </Layout>
  );
}
