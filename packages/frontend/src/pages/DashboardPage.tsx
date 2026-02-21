import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/Dashboard/StatCard';
import { QuickActionCard } from '@/components/Dashboard/QuickActionCard';
import { LiveOperationsWidget, type RunningSlideshowGroup } from '@/components/Dashboard/LiveOperationsWidget';
import { ContentQualityWidget } from '@/components/Dashboard/ContentQualityWidget';
import { ActivityFeedWidget, type ActivityItem } from '@/components/Dashboard/ActivityFeedWidget';
import { SystemChecksWidget } from '@/components/Dashboard/SystemChecksWidget';
import { MediaInsightsWidget } from '@/components/Dashboard/MediaInsightsWidget';
import { StatusBadge, type StatusTone } from '@/components/StatusBadge';
import { useSchedule, useScheduleHistory } from '@/hooks/useSchedule';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { API_URL } from '@/config/env';
import { systemApi } from '@/services/api';
import { formatFileSize, type Media } from '@/types/media.types';
import { resolveLivePresetKey, PRESET_LABELS } from '@/types/schedule.types';
import { getActiveEvent } from '@/types/settings.types';
import type { Device } from '@/types/device.types';
import { createDefaultSlideshowConfig, getEnabledSlides, type SlideshowConfig } from '@/types/slideshow.types';
import { ONLINE_THRESHOLD_MINUTES } from '@/utils/constants';
import { getMinutesSince, toValidDate } from '@/utils/dateUtils';
import { isPlainRecord } from '@/utils/objectUtils';
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

// ── Types ──────────────────────────────────────────────────────────────

type DashboardWidgetKey =
  | 'liveOperations'
  | 'contentQuality'
  | 'activityFeed'
  | 'systemChecks'
  | 'mediaInsights'
  | 'quickActions';

type WidgetVisibilityState = Record<DashboardWidgetKey, boolean>;

interface WidgetPreferenceItem {
  key: DashboardWidgetKey;
  title: string;
  description: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_WIDGET_VISIBILITY: WidgetVisibilityState = {
  liveOperations: true,
  contentQuality: true,
  activityFeed: true,
  systemChecks: true,
  mediaInsights: true,
  quickActions: true,
};

const WIDGET_PREFERENCES: WidgetPreferenceItem[] = [
  { key: 'liveOperations', title: 'Live-Betrieb', description: 'Online/Offline-Status und Ausspielungsmodi der Displays' },
  { key: 'contentQuality', title: 'Inhalte & Planqualität', description: 'Live-Preset, Event-Status und Plan-Checks' },
  { key: 'activityFeed', title: 'Letzte Aktivitäten', description: 'Chronologischer Verlauf von Uploads und Änderungen' },
  { key: 'systemChecks', title: 'System-Checks', description: 'Backend, Datenbasis, WebSocket und Update-Status' },
  { key: 'mediaInsights', title: 'Medien-Insights', description: 'Dateitypen, Gesamtgröße und letzter Upload' },
  { key: 'quickActions', title: 'Schnellzugriff', description: 'Direkte Navigation in die wichtigsten Arbeitsbereiche' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function hasDeviceOverrides(device: Device): boolean {
  const hasScheduleOverride = Boolean(
    device.overrides?.schedule &&
    typeof device.overrides.schedule === 'object' &&
    'presets' in device.overrides.schedule
  );
  const hasSettingsOverride = Boolean(
    device.overrides?.settings &&
    typeof device.overrides.settings === 'object' &&
    Object.keys(device.overrides.settings).length > 0
  );
  return hasScheduleOverride || hasSettingsOverride;
}

function getLatestMediaItem(media: Media[]): Media | null {
  if (media.length === 0) return null;
  return media.reduce((latest, current) =>
    new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest
  );
}

function isSlideshowConfig(value: unknown): value is SlideshowConfig {
  if (!isPlainRecord(value)) return false;
  return typeof value.layout === 'string' && Array.isArray(value.slides);
}

function getSlideshowFingerprint(config: SlideshowConfig): string {
  const normalizedSlides = [...(config.slides || [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((slide) => ({
      type: slide.type, enabled: slide.enabled, duration: slide.duration,
      order: slide.order, zoneId: slide.zoneId || 'main', saunaId: slide.saunaId || null,
      mediaId: slide.mediaId || null, infoId: slide.infoId || null,
      transition: slide.transition || 'none', videoPlayback: slide.videoPlayback || null,
    }));

  return JSON.stringify({
    layout: config.layout, defaultDuration: config.defaultDuration,
    defaultTransition: config.defaultTransition, enableTransitions: config.enableTransitions,
    slides: normalizedSlides,
  });
}

function getDeviceSlideshowOverride(device: Device): SlideshowConfig | null {
  const overrideSettings = device.overrides?.settings;
  if (!isPlainRecord(overrideSettings)) return null;
  const slideshow = overrideSettings.slideshow;
  if (!isSlideshowConfig(slideshow)) return null;
  return slideshow;
}

function parseWidgetVisibility(raw: string | null): WidgetVisibilityState {
  if (!raw) return DEFAULT_WIDGET_VISIBILITY;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetVisibilityState>;
    return {
      liveOperations: parsed.liveOperations !== false,
      contentQuality: parsed.contentQuality !== false,
      activityFeed: parsed.activityFeed !== false,
      systemChecks: parsed.systemChecks !== false,
      mediaInsights: parsed.mediaInsights !== false,
      quickActions: parsed.quickActions !== false,
    };
  } catch {
    return DEFAULT_WIDGET_VISIBILITY;
  }
}

// ── Component ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const scheduleQuery = useSchedule();
  const scheduleHistoryQuery = useScheduleHistory(30);
  const settingsQuery = useSettings();
  const devicesQuery = useDevices();
  const mediaQuery = useMedia();
  const { user, token } = useAuth();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const { isConnected: wsConnected, error: wsError } = useWebSocket({ autoConnect: true });
  const widgetStorageKey = `htmlsignage_dashboard_widgets_${user?.id || 'anonymous'}`;
  const [widgetVisibility, setWidgetVisibility] = useState<WidgetVisibilityState>(DEFAULT_WIDGET_VISIBILITY);
  const [isWidgetPanelOpen, setIsWidgetPanelOpen] = useState(false);

  const schedule = scheduleQuery.schedule;
  const settings = settingsQuery.settings;
  const devices = devicesQuery.data || [];
  const media = mediaQuery.data || [];
  const now = new Date();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(widgetStorageKey);
    setWidgetVisibility(parseWidgetVisibility(stored));
  }, [widgetStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(widgetStorageKey, JSON.stringify(widgetVisibility));
  }, [widgetStorageKey, widgetVisibility]);

  const backendHealthQuery = useQuery({
    queryKey: ['dashboard-health'],
    queryFn: async (): Promise<{ status: string; timestamp?: string }> => {
      const response = await fetch(`${API_URL}/health`);
      if (!response.ok) throw new Error(`Health check failed (${response.status})`);
      return response.json();
    },
    refetchInterval: 30000,
  });

  const systemStatusQuery = useQuery({
    queryKey: ['dashboard-system-update-status'],
    queryFn: () => systemApi.getUpdateStatus(token!),
    enabled: isAdmin && Boolean(token),
    refetchInterval: 60000,
  });

  const isLoading = scheduleQuery.isLoading || settingsQuery.isLoading || devicesQuery.isLoading || mediaQuery.isLoading;

  // ── Derived state ────────────────────────────────────────────────────

  const liveState = useMemo(() => {
    const pairedDevices = devices.filter((d) => Boolean(d.pairedAt));
    const onlinePairedDevices = pairedDevices.filter((d) => {
      const m = getMinutesSince(d.lastSeen);
      return m !== null && m < ONLINE_THRESHOLD_MINUTES;
    });
    const neverSeenDevices = pairedDevices.filter((d) => getMinutesSince(d.lastSeen) === null).length;
    const onlineDevices = onlinePairedDevices.length;
    const offlineDevices = Math.max(pairedDevices.length - onlineDevices - neverSeenDevices, 0);
    const overrideModeDevices = pairedDevices.filter((d) => d.mode === 'override').length;
    const autoModeDevices = pairedDevices.length - overrideModeDevices;
    const devicesWithOverrides = pairedDevices.filter(hasDeviceOverrides).length;
    const activeOverrideDevices = pairedDevices.filter((d) => d.mode === 'override' && hasDeviceOverrides(d)).length;
    const activeEvent = settings ? getActiveEvent(settings, now) : null;
    const activePreset = schedule ? resolveLivePresetKey(schedule, settings, now) : null;
    const pendingPairings = devices.length - pairedDevices.length;

    return {
      pairedDevices, onlinePairedDevices, pendingPairings, onlineDevices, offlineDevices,
      neverSeenDevices, overrideModeDevices, autoModeDevices, devicesWithOverrides,
      activeOverrideDevices, activeEvent, activePreset,
    };
  }, [devices, schedule, settings, now]);

  const planQuality = useMemo(() => {
    if (!schedule?.presets) return { totalRows: 0, emptyRows: 0, inconsistentRows: 0, duplicateTimeRows: 0, fillRate: 0 };
    let totalRows = 0, emptyRows = 0, inconsistentRows = 0, duplicateTimeRows = 0;
    for (const preset of Object.values(schedule.presets)) {
      const seenTimes = new Set<string>();
      for (const row of preset.rows) {
        totalRows += 1;
        if (!(row.entries || []).some((e) => Boolean(e?.title?.trim()))) emptyRows += 1;
        if ((row.entries?.length || 0) !== preset.saunas.length) inconsistentRows += 1;
        if (seenTimes.has(row.time)) duplicateTimeRows += 1;
        else seenTimes.add(row.time);
      }
    }
    return { totalRows, emptyRows, inconsistentRows, duplicateTimeRows, fillRate: totalRows > 0 ? Math.round(((totalRows - emptyRows) / totalRows) * 100) : 0 };
  }, [schedule]);

  const mediaStats = useMemo(() => {
    const images = media.filter((i) => i.type === 'image').length;
    const audioCount = media.filter((i) => i.type === 'audio').length;
    const videos = media.filter((i) => i.type === 'video').length;
    const totalSize = media.reduce((sum, i) => sum + i.size, 0);
    const latestMedia = getLatestMediaItem(media);
    return { total: media.length, images, audio: audioCount, videos, totalSize, latestMedia };
  }, [media]);

  const eventStats = useMemo(() => {
    const events = settings?.events || [];
    return { total: events.length, enabled: events.filter((e) => e.isActive).length, activeName: liveState.activeEvent?.name || null };
  }, [settings, liveState.activeEvent]);

  const runningSlideshows = useMemo<RunningSlideshowGroup[]>(() => {
    const globalConfig = settings?.slideshow || createDefaultSlideshowConfig();
    const groups: RunningSlideshowGroup[] = [];
    const overrideGroups = new Map<string, RunningSlideshowGroup>();

    const globalDeviceNames = liveState.onlinePairedDevices
      .filter((d) => !(d.mode === 'override' && getDeviceSlideshowOverride(d)))
      .map((d) => d.name);

    groups.push({
      id: 'global', source: 'global', title: 'Globale Slideshow', config: globalConfig,
      slides: getEnabledSlides(globalConfig).slice(0, 4), deviceNames: globalDeviceNames,
    });

    for (const device of liveState.onlinePairedDevices) {
      if (device.mode !== 'override') continue;
      const overrideConfig = getDeviceSlideshowOverride(device);
      if (!overrideConfig) continue;
      const fingerprint = getSlideshowFingerprint(overrideConfig);
      const existing = overrideGroups.get(fingerprint);
      if (existing) { existing.deviceNames.push(device.name); continue; }
      overrideGroups.set(fingerprint, {
        id: `override-${overrideGroups.size + 1}`, source: 'override',
        title: `Override Slideshow ${overrideGroups.size + 1}`, config: overrideConfig,
        slides: getEnabledSlides(overrideConfig).slice(0, 4), deviceNames: [device.name],
      });
    }

    return [...groups, ...Array.from(overrideGroups.values())];
  }, [liveState.onlinePairedDevices, settings?.slideshow]);

  const systemChecks = useMemo(() => {
    const backendTone: StatusTone = backendHealthQuery.isError ? 'danger' : backendHealthQuery.data?.status === 'ok' ? 'success' : 'warning';
    const dataTone: StatusTone = (scheduleQuery.error || settingsQuery.error || devicesQuery.error || mediaQuery.error) ? 'danger' : (schedule && settings) ? 'success' : 'warning';
    const websocketTone: StatusTone = wsConnected ? 'success' : wsError ? 'danger' : 'warning';
    const updateTone: StatusTone = !isAdmin ? 'neutral' : systemStatusQuery.isError ? 'danger' : systemStatusQuery.data?.isRunning ? 'info' : systemStatusQuery.data?.hasUpdate ? 'warning' : systemStatusQuery.data?.isDirty ? 'warning' : 'success';
    return { backendTone, dataTone, websocketTone, updateTone };
  }, [backendHealthQuery.isError, backendHealthQuery.data, scheduleQuery.error, settingsQuery.error, devicesQuery.error, mediaQuery.error, schedule, settings, wsConnected, wsError, isAdmin, systemStatusQuery.isError, systemStatusQuery.data]);

  const updateLabel = useMemo(() => {
    if (systemStatusQuery.data?.isRunning) return 'Läuft';
    if (systemStatusQuery.data?.hasUpdate) return `Verfügbar (${systemStatusQuery.data.behindCount || 0})`;
    if (systemStatusQuery.data?.isDirty) return 'Lokale Änderungen';
    return 'Aktuell';
  }, [systemStatusQuery.data]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const entry of (scheduleHistoryQuery.data || []).slice(0, 10)) {
      items.push({
        id: `schedule-${entry.id}`, title: `Aufgussplan v${entry.version} gespeichert`,
        description: entry.isActive ? 'Als aktiver Plan gesetzt' : 'Historische Planversion',
        tone: entry.isActive ? 'success' : 'neutral', timestamp: toValidDate(entry.createdAt), actor: 'Unbekannt',
      });
    }
    for (const item of [...media].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10)) {
      items.push({
        id: `media-${item.id}`, title: `Medium hochgeladen: ${item.originalName}`,
        description: `${item.type} · ${formatFileSize(item.size)}`, tone: 'info',
        timestamp: toValidDate(item.createdAt), actor: item.user?.username || 'Unbekannt',
      });
    }
    for (const device of [...devices].filter((d) => Boolean(d.pairedAt)).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 8)) {
      items.push({
        id: `device-${device.id}`, title: `Gerät aktualisiert: ${device.name}`,
        description: `Modus: ${device.mode === 'override' ? 'Override' : 'Auto'}`,
        tone: device.mode === 'override' ? 'warning' : 'neutral',
        timestamp: toValidDate(device.updatedAt) || toValidDate(device.pairedAt), actor: device.user?.username || 'Unbekannt',
      });
    }
    if (liveState.activeEvent) {
      items.push({
        id: 'active-event', title: `Event aktiv: ${liveState.activeEvent.name}`,
        description: `Preset ${liveState.activeEvent.assignedPreset} ist live`, tone: 'info',
        timestamp: new Date(`${liveState.activeEvent.startDate}T${liveState.activeEvent.startTime}`), actor: 'System',
      });
    }
    if (liveState.offlineDevices > 0) items.push({ id: 'offline-devices', title: `${liveState.offlineDevices} Gerät(e) offline`, description: 'Bitte Verbindungsstatus und Display-Clients prüfen', tone: 'warning', actor: 'System' });
    if (liveState.pendingPairings > 0) items.push({ id: 'pending-pairings', title: `${liveState.pendingPairings} ausstehende Pairings`, description: 'Neue Bildschirme warten auf Freigabe', tone: 'warning', actor: 'System' });
    if (systemStatusQuery.data?.hasUpdate) items.push({ id: 'system-update', title: 'Systemupdate verfügbar', description: `${systemStatusQuery.data.behindCount || 0} Commit(s) hinter origin/${systemStatusQuery.data.branch || 'main'}`, tone: 'warning', actor: 'System' });
    if (settings) items.push({ id: 'settings-version', title: `Einstellungen v${settings.version} geladen`, description: `Design: ${settings.designStyle || 'modern-wellness'}`, tone: 'success', actor: 'System' });

    return items.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0)).slice(0, 30);
  }, [devices, liveState, media, scheduleHistoryQuery.data, settings, systemStatusQuery.data]);

  // ── Widget visibility ────────────────────────────────────────────────

  const activeWidgetCount = useMemo(() => Object.values(widgetVisibility).filter(Boolean).length, [widgetVisibility]);
  const hasLeftWidgets = widgetVisibility.liveOperations || widgetVisibility.contentQuality || widgetVisibility.activityFeed;
  const hasRightWidgets = widgetVisibility.systemChecks || widgetVisibility.mediaInsights || widgetVisibility.quickActions;

  const toggleWidgetVisibility = (key: DashboardWidgetKey) => setWidgetVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  const showAllWidgets = () => setWidgetVisibility({ ...DEFAULT_WIDGET_VISIBILITY });
  const setOpsFocusWidgets = () => setWidgetVisibility({ liveOperations: true, contentQuality: false, activityFeed: true, systemChecks: true, mediaInsights: false, quickActions: true });

  const quickActions = [
    { title: 'Aufgussplan bearbeiten', description: 'Wochenplan pflegen und Event-Presets verwalten', icon: Calendar, href: '/schedule', color: 'primary' as const },
    { title: 'Gerätestatus', description: 'Offline-Displays, Pairings und Modi prüfen', icon: Monitor, href: '/devices', color: 'info' as const },
    { title: 'Medien aktualisieren', description: 'Bilder, Audio und Video hochladen', icon: Upload, href: '/media', color: 'violet' as const },
    { title: 'Systemwartung', description: 'Update-Status, Backup-Import und Export', icon: Settings, href: '/settings', color: 'success' as const },
  ];

  // ── Render ───────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner label="Lade Dashboard..." />
      </Layout>
    );
  }

  const livePresetLabel = liveState.activePreset ? PRESET_LABELS[liveState.activePreset] : '-';
  const planQualityTone: StatusTone = (planQuality.inconsistentRows > 0 || planQuality.duplicateTimeRows > 0) ? 'danger' : planQuality.emptyRows > 0 ? 'warning' : 'success';

  return (
    <Layout>
      <div className="space-y-8">
        {/* Status Banner */}
        <div className="rounded-xl bg-gradient-to-r from-spa-primary/10 to-spa-secondary/15 border border-spa-bg-secondary p-6">
          <h2 className="text-3xl font-bold text-spa-text-primary mb-2">Dashboard</h2>
          <p className="text-spa-text-secondary">Betriebszentrale für Displays, Inhalte und Systemzustand</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge label={wsConnected ? 'WebSocket verbunden' : 'WebSocket getrennt'} tone={systemChecks.websocketTone} pulse={wsConnected} />
            <StatusBadge label={backendHealthQuery.data?.status === 'ok' ? 'Backend erreichbar' : 'Backend prüfen'} tone={systemChecks.backendTone} />
            <StatusBadge label={liveState.activeEvent ? `Event live: ${liveState.activeEvent.name}` : 'Kein Event aktiv'} tone={liveState.activeEvent ? 'info' : 'neutral'} showDot={Boolean(liveState.activeEvent)} />
            <StatusBadge label={schedule?.autoPlay ? 'Auto-Play aktiv' : 'Manueller Planmodus'} tone={schedule?.autoPlay ? 'success' : 'warning'} />
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
              <p className="text-sm text-spa-text-secondary mt-1">{activeWidgetCount} von {WIDGET_PREFERENCES.length} Widgets sichtbar</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setIsWidgetPanelOpen((p) => !p)} className="px-3 py-2 text-sm bg-spa-bg-secondary text-spa-text-primary rounded-lg hover:bg-spa-secondary/20 transition-colors inline-flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                {isWidgetPanelOpen ? 'Anpassung schließen' : 'Widgets anpassen'}
              </button>
              <button onClick={setOpsFocusWidgets} className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">Ops-Fokus</button>
              <button onClick={showAllWidgets} className="px-3 py-2 text-sm bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">Alle anzeigen</button>
            </div>
          </div>
          {isWidgetPanelOpen && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {WIDGET_PREFERENCES.map((widget) => {
                const isEnabled = widgetVisibility[widget.key];
                return (
                  <button
                    key={widget.key}
                    onClick={() => toggleWidgetVisibility(widget.key)}
                    className={`text-left rounded-lg border p-3 transition-colors ${isEnabled ? 'border-spa-primary/40 bg-spa-primary/5' : 'border-spa-bg-secondary bg-white hover:border-spa-primary/30'}`}
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
          <StatCard title="Live-Betrieb" value={`${liveState.onlineDevices}/${liveState.pairedDevices.length}`} icon={liveState.onlineDevices > 0 ? Wifi : WifiOff} description={`${liveState.offlineDevices} offline · ${liveState.pendingPairings} pending`} color={liveState.offlineDevices > 0 ? 'warning' : 'success'} href="/devices" ctaLabel="Zu Geräten" />
          <StatCard title="Aktiver Plan" value={livePresetLabel} icon={Play} description={liveState.activeEvent ? `Event: ${liveState.activeEvent.name}` : 'Regulärer Tagesplan'} color={liveState.activeEvent ? 'info' : 'primary'} href="/schedule" ctaLabel="Zum Aufgussplan" />
          <StatCard title="Planqualität" value={`${planQuality.fillRate}%`} icon={TrendingUp} description={`${planQuality.emptyRows} leere Zeilen · ${planQuality.inconsistentRows + planQuality.duplicateTimeRows} Konflikte`} color={planQualityTone === 'danger' ? 'danger' : planQualityTone === 'warning' ? 'warning' : 'success'} href="/schedule" ctaLabel="Checks öffnen" />
          <StatCard title="Event-Setup" value={`${eventStats.enabled}/${eventStats.total}`} icon={Calendar} description={eventStats.activeName ? `Aktiv: ${eventStats.activeName}` : 'Kein Event aktiv'} color={eventStats.activeName ? 'info' : eventStats.enabled > 0 ? 'primary' : 'neutral'} href="/settings" ctaLabel="Zu Einstellungen" />
        </div>

        {activeWidgetCount === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center justify-between gap-3">
            <span>Alle Widgets sind ausgeblendet. Aktiviere mindestens ein Widget für das Dashboard.</span>
            <button onClick={showAllWidgets} className="px-3 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 font-medium transition-colors">Widgets zurücksetzen</button>
          </div>
        )}

        {/* Widget Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {widgetVisibility.liveOperations && <LiveOperationsWidget liveState={liveState} runningSlideshows={runningSlideshows} />}
            {widgetVisibility.contentQuality && <ContentQualityWidget livePresetLabel={livePresetLabel} autoPlay={schedule?.autoPlay || false} activeEventName={liveState.activeEvent?.name || null} planQuality={planQuality} />}
            {widgetVisibility.activityFeed && <ActivityFeedWidget items={activityItems} />}
            {!hasLeftWidgets && (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
                <p className="text-sm text-spa-text-secondary">Im linken Bereich sind aktuell keine Widgets sichtbar. Aktiviere Widgets über "Widgets anpassen".</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {widgetVisibility.systemChecks && (
              <SystemChecksWidget
                backendStatus={backendHealthQuery.data?.status === 'ok' ? 'ok' : backendHealthQuery.isError ? 'error' : 'unknown'}
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
                latestMediaDate={mediaStats.latestMedia ? new Date(mediaStats.latestMedia.createdAt) : null}
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
                    <QuickActionCard key={action.href} title={action.title} description={action.description} icon={action.icon} href={action.href} color={action.color} />
                  ))}
                </div>
              </div>
            )}
            {!hasRightWidgets && (
              <div className="bg-white rounded-lg shadow-sm p-6 border border-spa-bg-secondary">
                <p className="text-sm text-spa-text-secondary">Im rechten Bereich sind aktuell keine Widgets sichtbar. Aktiviere Widgets über "Widgets anpassen".</p>
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
