import { Layout } from '@/components/Layout';
import { OperationsPulseWidget } from '@/components/Dashboard/OperationsPulseWidget';
import { AttentionBoardWidget } from '@/components/Dashboard/AttentionBoardWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaStatsWidget } from '@/components/Dashboard/MediaStatsWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { RunningSlideshowsWidget } from '@/components/Dashboard/RunningSlideshowsWidget';
import { PageHeader } from '@/components/PageHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SkeletonCard } from '@/components/Skeleton';
import { Button } from '@/components/Button';
import { AlertCircle, LayoutDashboard, RefreshCw } from 'lucide-react';

export function DashboardPage() {
  const {
    isLoading,
    scheduleQuery, settingsQuery, devicesQuery, mediaQuery, backendHealthQuery,
    schedule, wsConnected,
    isAdmin,
    liveState, mediaStats, eventStats,
    runningSlideshows, deviceSlideshowRows, systemChecks, updateLabel,
    runtimeStatus, runtimeHistory,
    activeSystemJobs, attentionItems,
    activityItems,
  } = useDashboardData();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-2xl bg-spa-bg-secondary" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </Layout>
    );
  }

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

  const hasErrors = scheduleQuery.error || settingsQuery.error || devicesQuery.error || mediaQuery.error || backendHealthQuery.error;

  const handleRefresh = () => {
    scheduleQuery.refetch();
    settingsQuery.refetch();
    devicesQuery.refetch();
    mediaQuery.refetch();
    backendHealthQuery.refetch();
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Dashboard Übersicht"
          description="Betriebszentrale für Displays, Inhalte und Systemzustand"
          icon={LayoutDashboard}
          actions={
            <Button variant="secondary" icon={RefreshCw} onClick={handleRefresh}>
              Aktualisieren
            </Button>
          }
          badges={[
            { label: attentionItems.length === 0 ? 'Normalbetrieb' : `${attentionItems.length} Meldungen`, tone: attentionItems.length === 0 ? 'success' : 'warning' },
            { label: `${liveState.onlinePairedDevices.length} Geräte online`, tone: liveState.onlinePairedDevices.length > 0 ? 'success' : 'neutral' },
          ]}
        />

        {/* Row 1: Betriebsstatus + Meldungen */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <OperationsPulseWidget
            liveState={liveState}
            activeSystemJobs={activeSystemJobs}
            runningSlideshows={runningSlideshows}
            nextEventLabel={nextEventDesc.value}
            activePreset={liveState.activePreset}
            autoPlay={Boolean(schedule?.autoPlay)}
            mediaStats={{
              total: mediaStats.images + mediaStats.audio + mediaStats.videos,
              totalSize: mediaStats.totalSize,
              latestName: mediaStats.latestMedia?.originalName || null,
            }}
          />
          <AttentionBoardWidget items={attentionItems} />
        </div>

        {/* Row 2: System-Checks + Medien-Statistiken + Aktivitäts-Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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
          <MediaStatsWidget
            images={mediaStats.images}
            audio={mediaStats.audio}
            videos={mediaStats.videos}
            totalSize={mediaStats.totalSize}
          />
          <ActivityFeedWidget items={activityItems} />
        </div>

        {/* Row 3: Laufende Slideshows */}
        <RunningSlideshowsWidget rows={deviceSlideshowRows} />

        {/* Error Banner */}
        {hasErrors && (
          <div className="flex items-center gap-2 rounded-lg border border-spa-error/30 bg-spa-error-light px-4 py-3 text-sm text-spa-error-dark" role="alert">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Ein oder mehrere Datenquellen konnten nicht geladen werden. Bitte API- und Netzwerkstatus prüfen.
          </div>
        )}
      </div>
    </Layout>
  );
}
