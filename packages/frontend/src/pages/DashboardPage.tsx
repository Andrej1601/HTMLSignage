import { Layout } from '@/components/Layout';
import { OperationsContentWidget } from '@/components/Dashboard/OperationsContentWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaInsightsWidget } from '@/components/Dashboard/MediaInsightsWidget';
import { AttentionBoardWidget } from '@/components/Dashboard/AttentionBoardWidget';
import { OperationsPulseWidget } from '@/components/Dashboard/OperationsPulseWidget';
import { PageHeader } from '@/components/PageHeader';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { useAuth } from '@/contexts/AuthContext';
import { useWidgetVisibility, WIDGET_PREFERENCES } from '@/hooks/useWidgetVisibility';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/Button';
import {
  AlertCircle,
  SlidersHorizontal,
  LayoutDashboard,
  ShieldAlert,
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
    liveState, mediaStats, eventStats,
    runningSlideshows, systemChecks, updateLabel,
    runtimeStatus, runtimeHistory, deviceMonitoring,
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

  const hasLeftWidgets =
    widgetVisibility.operationsContent || widgetVisibility.activityFeed;
  const hasRightWidgets =
    widgetVisibility.systemChecks || widgetVisibility.mediaInsights;

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Betriebszentrale für Displays, Inhalte und Systemzustand"
          icon={LayoutDashboard}
          actions={(
            <>
              <Button variant="secondary" size="sm" onClick={setOpsFocus}>
                Ops-Fokus
              </Button>
              <Button variant="ghost" size="sm" onClick={showAllWidgets}>
                Alle Widgets
              </Button>
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
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      open
                        ? 'border-spa-primary/30 bg-spa-primary/10 text-spa-primary'
                        : 'border-spa-bg-secondary bg-white text-spa-text-secondary hover:bg-spa-bg-primary hover:text-spa-text-primary'
                    }`}
                    aria-label="Widgets anpassen"
                    type="button"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Widgets
                  </button>
                )}
              />
            </>
          )}
          badges={[
            { label: liveState.activeEvent ? `Event: ${liveState.activeEvent.name}` : 'Kein Event aktiv', tone: liveState.activeEvent ? 'info' as const : 'neutral' as const },
            { label: schedule?.autoPlay ? 'Auto-Play' : 'Manuell', tone: schedule?.autoPlay ? 'success' as const : 'warning' as const },
            { label: attentionItems.length > 0 ? `${attentionItems.length} offene Punkte` : 'Betrieb stabil', tone: attentionItems.length > 0 ? attentionItems[0]?.tone || 'warning' : 'success' as const },
            { label: `${activeWidgetCount}/${WIDGET_PREFERENCES.length} Widgets`, tone: activeWidgetCount === 0 ? 'warning' as const : 'neutral' as const },
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

        {activeWidgetCount === 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-spa-warning/30 bg-spa-warning-light px-4 py-3 text-sm text-spa-warning-dark">
            <span>Alle Widgets sind ausgeblendet. Aktiviere mindestens ein Widget für das Dashboard.</span>
            <Button
              onClick={showAllWidgets}
              variant="warning"
              size="sm"
            >
              Widgets zurücksetzen
            </Button>
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
                    runtimeHistory={runtimeHistory}
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
