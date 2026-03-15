import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { OperationsContentWidget } from '@/components/Dashboard/OperationsContentWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaInsightsWidget } from '@/components/Dashboard/MediaInsightsWidget';
import { AttentionBoardWidget } from '@/components/Dashboard/AttentionBoardWidget';
import { OperationsPulseWidget } from '@/components/Dashboard/OperationsPulseWidget';
import { PageHeader } from '@/components/PageHeader';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermission';
import type { Permission } from '@/utils/permissions';
import { useWidgetVisibility, WIDGET_PREFERENCES } from '@/hooks/useWidgetVisibility';
import { useDashboardData } from '@/hooks/useDashboardData';
import { PRESET_LABELS } from '@/types/schedule.types';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  Calendar,
  Layers,
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
  ShieldAlert,
} from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuth();
  const perms = usePermissions();
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
    liveState, mediaStats, eventStats,
    runningSlideshows, systemChecks, updateLabel,
    runtimeStatus, deviceMonitoring,
    activeSystemJobs, attentionItems,
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

  // Next event description
  const nextEventDesc = (() => {
    if (liveState.activeEvent) {
      const endTime = liveState.activeEvent.endTime || '23:59';
      return { value: `${liveState.activeEvent.name} (bis ${endTime})`, tone: 'info' as const };
    }
    if (eventStats.nextEvent) {
      const d = eventStats.nextEvent.startDate.slice(5).replace('-', '.');
      return { value: `${eventStats.nextEvent.name} ab ${d}., ${eventStats.nextEvent.startTime}`, tone: 'info' as const };
    }
    return { value: 'Kein aktives Event', tone: 'neutral' as const };
  })();

  // Slideshow stats for the 3rd card
  const totalActiveSlides = runningSlideshows.reduce((sum, g) => sum + g.slides.length, 0);
  const globalSlideshow = runningSlideshows.find((g) => g.source === 'global');
  const overrideCount = runningSlideshows.filter((g) => g.source === 'override').length;

  const hasLeftWidgets =
    widgetVisibility.operationsContent || widgetVisibility.activityFeed;
  const hasRightWidgets =
    widgetVisibility.systemChecks || widgetVisibility.mediaInsights || widgetVisibility.quickActions;

  const allQuickActions: { title: string; description: string; icon: typeof Calendar; href: string; color: 'primary' | 'info' | 'violet' | 'success'; permission?: Permission }[] = [
    { title: 'Aufgussplan bearbeiten', description: 'Wochenplan pflegen und Event-Presets verwalten', icon: Calendar, href: '/schedule', color: 'primary', permission: 'schedule:write' },
    { title: 'Gerätestatus', description: 'Offline-Displays, Pairings und Modi prüfen', icon: Monitor, href: '/devices', color: 'info', permission: 'devices:manage' },
    { title: 'Medien aktualisieren', description: 'Bilder, Audio und Video hochladen', icon: Upload, href: '/media', color: 'violet', permission: 'media:manage' },
    { title: 'Systemwartung', description: 'Update-Status, Backup-Import und Export', icon: Settings, href: '/settings', color: 'success', permission: 'settings:manage' },
  ];
  const quickActions = allQuickActions.filter((a) => !a.permission || perms.has(a.permission));

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
            { label: attentionItems.length > 0 ? `${attentionItems.length} offene Punkte` : 'Betrieb stabil', tone: attentionItems.length > 0 ? attentionItems[0]?.tone || 'warning' : 'success' as const },
          ]}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <AttentionBoardWidget items={attentionItems} />
          <OperationsPulseWidget
            liveState={liveState}
            activeSystemJobs={activeSystemJobs}
            runningSlideshows={runningSlideshows}
            nextEventLabel={nextEventDesc.value}
            activePreset={liveState.activePreset}
            autoPlay={Boolean(schedule?.autoPlay)}
          />
        </div>

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
            details={[
              { label: 'Modus', value: schedule?.autoPlay ? 'Auto-Play' : 'Manuell', tone: schedule?.autoPlay ? 'success' : 'warning' },
              { label: 'Nächster Event', value: nextEventDesc.value, tone: nextEventDesc.tone },
            ]}
            color={liveState.activeEvent ? 'info' : 'primary'}
            href="/schedule"
            ctaLabel="Zum Aufgussplan"
          />
          <StatCard
            title="Slideshow"
            value={`${totalActiveSlides} Slides`}
            icon={Layers}
            details={[
              ...(globalSlideshow
                ? [{ label: 'Layout', value: globalSlideshow.config.layout === 'split-view' ? 'Split View' : globalSlideshow.config.layout === 'full-rotation' ? 'Vollbild' : globalSlideshow.config.layout, tone: 'neutral' as const }]
                : []),
              ...(overrideCount > 0
                ? [{ label: 'Overrides', value: `${overrideCount} Gerät(e)`, tone: 'warning' as const }]
                : []),
              { label: 'Geräte', value: `${liveState.onlineDevices} online`, tone: liveState.offlineDevices > 0 ? 'warning' as const : 'success' as const },
            ]}
            color="success"
            href="/slideshow"
            ctaLabel="Zur Slideshow"
          />
        </div>

        {activeWidgetCount === 0 && (
          <div className="rounded-lg border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark flex items-center justify-between gap-3">
            <span>Alle Widgets sind ausgeblendet. Aktiviere mindestens ein Widget für das Dashboard.</span>
            <button
              onClick={showAllWidgets}
              className="px-3 py-1.5 rounded-lg bg-spa-warning/15 hover:bg-spa-warning/25 text-spa-warning-dark font-medium transition-colors"
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
                    deviceMonitoring={deviceMonitoring}
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
                    runtimeStatus={runtimeStatus}
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
                      Direktzugriffe
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
          <div className="rounded-lg border border-spa-error/30 bg-spa-error-light px-4 py-3 text-sm text-spa-error-dark flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4" />
            Ein oder mehrere Datenquellen konnten nicht geladen werden. Bitte API- und Netzwerkstatus prüfen.
          </div>
        )}

        {attentionItems.length === 0 && activeSystemJobs.length === 0 && (
          <div className="rounded-2xl border border-spa-success/20 bg-spa-success-light/60 px-4 py-3 text-sm text-spa-success-dark flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Kein akuter Eingriff nötig. Nutze den Dashboard-Bereich jetzt vor allem für Planung, Vorschau und Qualitätskontrolle.
          </div>
        )}
      </div>
    </Layout>
  );
}
