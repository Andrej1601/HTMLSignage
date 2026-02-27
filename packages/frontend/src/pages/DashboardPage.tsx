import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { OperationsContentWidget } from '@/components/Dashboard/OperationsContentWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaInsightsWidget } from '@/components/Dashboard/MediaInsightsWidget';
import { PageHeader } from '@/components/PageHeader';
import { type StatusTone } from '@/components/StatusBadge';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useWidgetVisibility, WIDGET_PREFERENCES } from '@/hooks/useWidgetVisibility';
import { useDashboardData } from '@/hooks/useDashboardData';
import { PRESET_LABELS } from '@/types/schedule.types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Activity,
  Calendar,
  Monitor,
  Settings,
  Wifi,
  WifiOff,
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

  const systemHealthValue =
    systemChecks.backendTone === 'success' && systemChecks.websocketTone === 'success'
      ? 'OK'
      : systemChecks.backendTone === 'danger' ? 'Fehler' : 'Warnung';

  const systemHealthColor: 'success' | 'warning' | 'danger' =
    systemChecks.backendTone === 'danger' ? 'danger'
    : systemChecks.websocketTone !== 'success' ? 'warning'
    : 'success';

  const hasLeftWidgets =
    widgetVisibility.operationsContent || widgetVisibility.activityFeed;
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
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Betriebszentrale für Displays, Inhalte und Systemzustand"
          icon={LayoutDashboard}
          badges={[
            { label: liveState.activeEvent ? `Event: ${liveState.activeEvent.name}` : 'Kein Event aktiv', tone: liveState.activeEvent ? 'info' as const : 'neutral' as const },
            { label: schedule?.autoPlay ? 'Auto-Play' : 'Manuell', tone: schedule?.autoPlay ? 'success' as const : 'warning' as const },
          ]}
        />

        {/* Compact Widget Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-spa-text-secondary">
            {activeWidgetCount} von {WIDGET_PREFERENCES.length} Widgets sichtbar
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={setOpsFocus}
              className="px-3 py-1.5 text-sm bg-spa-primary/10 text-spa-primary rounded-lg hover:bg-spa-primary/20 transition-colors"
            >
              Ops-Fokus
            </button>
            <button
              onClick={showAllWidgets}
              className="px-3 py-1.5 text-sm bg-spa-secondary/10 text-spa-secondary-dark rounded-lg hover:bg-spa-secondary/20 transition-colors"
            >
              Alle
            </button>
            <DropdownMenu
              sections={[
                WIDGET_PREFERENCES.map((widget) => ({
                  label: `${widgetVisibility[widget.key] ? '\u2713' : '\u2717'} ${widget.title}`,
                  icon: SlidersHorizontal,
                  onClick: () => toggleWidget(widget.key),
                  keepOpen: true,
                })),
              ]}
              width="w-64"
              trigger={(open) => (
                <button
                  className={`p-2 rounded-lg transition-colors ${
                    open ? 'bg-spa-primary/10' : 'bg-spa-bg-secondary hover:bg-spa-secondary/20'
                  }`}
                  aria-label="Widgets anpassen"
                >
                  <SlidersHorizontal className="w-4 h-4 text-spa-text-secondary" />
                </button>
              )}
            />
          </div>
        </div>

        {/* KPI Row — 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Geräte"
            value={`${liveState.onlineDevices}/${liveState.pairedDevices.length}`}
            icon={liveState.offlineDevices > 0 ? WifiOff : Wifi}
            description={
              liveState.offlineDevices > 0
                ? `${liveState.offlineDevices} offline · ${liveState.pendingPairings} ausstehend`
                : `Alle online · ${liveState.pendingPairings} ausstehend`
            }
            color={liveState.offlineDevices > 0 ? 'warning' : 'success'}
            href="/devices"
            ctaLabel="Zu Geräten"
          />
          <StatCard
            title="Tagesplan"
            value={livePresetLabel}
            icon={Play}
            description={
              liveState.activeEvent
                ? `Event: ${liveState.activeEvent.name} · bis ${liveState.activeEvent.endTime || '23:59'}`
                : eventStats.nextEvent
                  ? `Event „${eventStats.nextEvent.name}" ab ${eventStats.nextEvent.startDate.slice(5).replace('-', '.')}.`
                  : `${planQuality.fillRate}% befüllt · ${planQuality.emptyRows} leer`
            }
            color={planQualityTone === 'danger' ? 'danger' : planQualityTone === 'warning' ? 'warning' : 'primary'}
            href="/schedule"
            ctaLabel="Zum Aufgussplan"
          />
          <StatCard
            title="System"
            value={systemHealthValue}
            icon={Activity}
            description={`${updateLabel} · WS ${wsConnected ? 'verbunden' : 'getrennt'}`}
            color={systemHealthColor}
            href="/settings"
            ctaLabel="Zum System"
          />
        </div>

        {activeWidgetCount === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>Alle Widgets sind ausgeblendet. Aktiviere mindestens ein Widget für das Dashboard.</span>
            <button
              onClick={showAllWidgets}
              className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium transition-colors"
            >
              Widgets zurücksetzen
            </button>
          </div>
        )}

        {/* Widget Grid */}
        {(hasLeftWidgets || hasRightWidgets) && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {hasLeftWidgets && (
              <div className="xl:col-span-2 space-y-6">
                {widgetVisibility.operationsContent && (
                  <OperationsContentWidget
                    liveState={liveState}
                    runningSlideshows={runningSlideshows}
                    livePresetLabel={livePresetLabel}
                    autoPlay={schedule?.autoPlay || false}
                    activeEventName={liveState.activeEvent?.name || null}
                    planQuality={planQuality}
                  />
                )}
                {widgetVisibility.activityFeed && <ActivityFeedWidget items={activityItems} />}
              </div>
            )}

            {hasRightWidgets && (
              <div className={hasLeftWidgets ? 'space-y-6' : 'xl:col-span-3 space-y-6'}>
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
              </div>
            )}
          </div>
        )}

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
