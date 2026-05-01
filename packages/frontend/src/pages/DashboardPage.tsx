import { Layout } from '@/components/Layout';
import { OperationsPulseWidget } from '@/components/Dashboard/OperationsPulseWidget';
import { AttentionBoardWidget } from '@/components/Dashboard/AttentionBoardWidget';
import { OnboardingChecklistWidget } from '@/components/Dashboard/OnboardingChecklistWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaStatsWidget } from '@/components/Dashboard/MediaStatsWidget';
import { ActivityFeedWidget } from '@/components/Dashboard/ActivityFeedWidget';
import { RunningSlideshowsWidget } from '@/components/Dashboard/RunningSlideshowsWidget';
import { InlineErrorBoundary } from '@/components/InlineErrorBoundary';
import { PageHeader } from '@/components/PageHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SkeletonCard } from '@/components/Skeleton';
import { Button } from '@/components/Button';
import { AlertCircle, LayoutDashboard, RefreshCw } from 'lucide-react';

export function DashboardPage() {
  const {
    isLoading,
    scheduleQuery, settingsQuery, devicesQuery, mediaQuery, backendHealthQuery,
    schedule, settings, wsConnected,
    isAdmin,
    liveState, mediaStats, eventStats,
    deviceSlideshowRows, systemChecks, updateLabel,
    runtimeStatus,
    attentionItems,
    activityItems,
    onboardingState,
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
          <InlineErrorBoundary fallbackLabel="Betriebsstatus konnte nicht geladen werden.">
            <OperationsPulseWidget
              liveState={liveState}
              nextEventLabel={nextEventDesc.value}
              activePreset={liveState.activePreset}
              autoPlay={Boolean(schedule?.autoPlay)}
              schedule={schedule ?? null}
              settings={settings ?? null}
            />
          </InlineErrorBoundary>
          <InlineErrorBoundary fallbackLabel="Meldungen konnten nicht geladen werden.">
            <AttentionBoardWidget items={attentionItems} />
          </InlineErrorBoundary>
        </div>

        {/* Onboarding-Checkliste — nur sichtbar solange noch nicht alle
            Setup-Schritte abgehakt sind. */}
        <InlineErrorBoundary fallbackLabel="Onboarding-Übersicht konnte nicht geladen werden.">
          <OnboardingChecklistWidget state={onboardingState} />
        </InlineErrorBoundary>

        {/* Row 2: Geräte-Übersicht (vereint Slideshow-Status + Health) */}
        <InlineErrorBoundary fallbackLabel="Geräte-Übersicht konnte nicht geladen werden.">
          <RunningSlideshowsWidget rows={deviceSlideshowRows} />
        </InlineErrorBoundary>

        {/* Row 3: System-Checks + Medien-Statistiken */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <InlineErrorBoundary fallbackLabel="System-Checks konnten nicht geladen werden.">
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
          </InlineErrorBoundary>
          <InlineErrorBoundary fallbackLabel="Medien & Speicher konnte nicht geladen werden.">
            <MediaStatsWidget
              images={mediaStats.images}
              audio={mediaStats.audio}
              videos={mediaStats.videos}
              totalSize={mediaStats.totalSize}
              latestMedia={mediaStats.latestMedia}
              runtimeStatus={runtimeStatus}
            />
          </InlineErrorBoundary>
        </div>

        {/* Row 4: Audit-Log (full width) */}
        <InlineErrorBoundary fallbackLabel="Aktivitäts-Feed konnte nicht geladen werden.">
          <ActivityFeedWidget items={activityItems} />
        </InlineErrorBoundary>

        {/* Error Banner */}
        {hasErrors && (
          <div className="flex items-center gap-2 rounded-lg border border-spa-error/30 bg-spa-error-light px-4 py-3 text-sm text-spa-error-dark" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Ein oder mehrere Datenquellen konnten nicht geladen werden. Bitte API- und Netzwerkstatus prüfen.
          </div>
        )}
      </div>
    </Layout>
  );
}
