import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSchedule, useScheduleHistory } from '@/hooks/useSchedule';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { API_URL } from '@/config/env';
import { systemApi } from '@/services/api';
import { formatFileSize, type Media } from '@/types/media.types';
import { resolveLivePresetKey, type PresetKey } from '@/types/schedule.types';
import { getActiveEvent } from '@/types/settings.types';
import type { Device } from '@/types/device.types';
import { createDefaultSlideshowConfig, getEnabledSlides, type SlideshowConfig } from '@/types/slideshow.types';
import { ONLINE_THRESHOLD_MINUTES } from '@/utils/constants';
import { getMinutesSince, toValidDate } from '@/utils/dateUtils';
import { isPlainRecord } from '@/utils/objectUtils';
import { hasDeviceOverrides, getDeviceOverrideSettings } from '@/utils/deviceUtils';
import type { ActivityItem } from '@/components/Dashboard/ActivityFeedWidget';
import type { RunningSlideshowGroup } from '@/components/Dashboard/LiveOperationsWidget';
import type { StatusTone } from '@/components/StatusBadge';

// ── Private helpers ─────────────────────────────────────────────────────────

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
  const overrideSettings = getDeviceOverrideSettings(device);
  const slideshow = overrideSettings.slideshow;
  if (!isSlideshowConfig(slideshow)) return null;
  return slideshow;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface DashboardSystemChecks {
  backendTone: StatusTone;
  dataTone: StatusTone;
  websocketTone: StatusTone;
  updateTone: StatusTone;
}

export interface DashboardLiveState {
  pairedDevices: Device[];
  onlinePairedDevices: Device[];
  pendingPairings: number;
  onlineDevices: number;
  offlineDevices: number;
  neverSeenDevices: number;
  overrideModeDevices: number;
  autoModeDevices: number;
  devicesWithOverrides: number;
  activeOverrideDevices: number;
  activeEvent: ReturnType<typeof getActiveEvent>;
  activePreset: PresetKey | null;
}

export interface DashboardPlanQuality {
  totalRows: number;
  emptyRows: number;
  inconsistentRows: number;
  duplicateTimeRows: number;
  fillRate: number;
}

export interface DashboardMediaStats {
  total: number;
  images: number;
  audio: number;
  videos: number;
  totalSize: number;
  latestMedia: Media | null;
}

export function useDashboardData() {
  const scheduleQuery = useSchedule();
  const scheduleHistoryQuery = useScheduleHistory(30);
  const settingsQuery = useSettings();
  const devicesQuery = useDevices();
  const mediaQuery = useMedia();
  const { user, token } = useAuth();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const { isConnected: wsConnected, error: wsError } = useWebSocket({ autoConnect: true });

  const schedule = scheduleQuery.schedule;
  const settings = settingsQuery.settings;
  const devices = devicesQuery.data || [];
  const media = mediaQuery.data || [];

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

  const isLoading =
    scheduleQuery.isLoading ||
    settingsQuery.isLoading ||
    devicesQuery.isLoading ||
    mediaQuery.isLoading;

  // ── Derived state ──────────────────────────────────────────────────────

  const liveState = useMemo<DashboardLiveState>(() => {
    const now = new Date();
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
    const activeOverrideDevices = pairedDevices.filter(
      (d) => d.mode === 'override' && hasDeviceOverrides(d)
    ).length;
    const activeEvent = settings ? getActiveEvent(settings, now) : null;
    const activePreset = schedule ? resolveLivePresetKey(schedule, settings ?? undefined, now) : null;
    const pendingPairings = devices.length - pairedDevices.length;

    return {
      pairedDevices, onlinePairedDevices, pendingPairings, onlineDevices, offlineDevices,
      neverSeenDevices, overrideModeDevices, autoModeDevices, devicesWithOverrides,
      activeOverrideDevices, activeEvent, activePreset,
    };
  }, [devices, schedule, settings]);

  const planQuality = useMemo<DashboardPlanQuality>(() => {
    if (!schedule?.presets) {
      return { totalRows: 0, emptyRows: 0, inconsistentRows: 0, duplicateTimeRows: 0, fillRate: 0 };
    }
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
    const fillRate =
      totalRows > 0 ? Math.round(((totalRows - emptyRows) / totalRows) * 100) : 0;
    return { totalRows, emptyRows, inconsistentRows, duplicateTimeRows, fillRate };
  }, [schedule]);

  const mediaStats = useMemo<DashboardMediaStats>(() => {
    const images = media.filter((i) => i.type === 'image').length;
    const audioCount = media.filter((i) => i.type === 'audio').length;
    const videos = media.filter((i) => i.type === 'video').length;
    const totalSize = media.reduce((sum, i) => sum + i.size, 0);
    const latestMedia = getLatestMediaItem(media);
    return { total: media.length, images, audio: audioCount, videos, totalSize, latestMedia };
  }, [media]);

  const eventStats = useMemo(() => {
    const events = settings?.events || [];
    return {
      total: events.length,
      enabled: events.filter((e) => e.isActive).length,
      activeName: liveState.activeEvent?.name || null,
    };
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

  const systemChecks = useMemo<DashboardSystemChecks>(() => {
    const backendTone: StatusTone =
      backendHealthQuery.isError ? 'danger'
      : backendHealthQuery.data?.status === 'ok' ? 'success'
      : 'warning';
    const dataTone: StatusTone =
      (scheduleQuery.error || settingsQuery.error || devicesQuery.error || mediaQuery.error)
        ? 'danger'
        : (schedule && settings) ? 'success' : 'warning';
    const websocketTone: StatusTone =
      wsConnected ? 'success' : wsError ? 'danger' : 'warning';
    const updateTone: StatusTone =
      !isAdmin ? 'neutral'
      : systemStatusQuery.isError ? 'danger'
      : systemStatusQuery.data?.isRunning ? 'info'
      : systemStatusQuery.data?.hasUpdate ? 'warning'
      : systemStatusQuery.data?.isDirty ? 'warning'
      : 'success';
    return { backendTone, dataTone, websocketTone, updateTone };
  }, [
    backendHealthQuery.isError, backendHealthQuery.data,
    scheduleQuery.error, settingsQuery.error, devicesQuery.error, mediaQuery.error,
    schedule, settings, wsConnected, wsError, isAdmin,
    systemStatusQuery.isError, systemStatusQuery.data,
  ]);

  const updateLabel = useMemo(() => {
    if (systemStatusQuery.data?.isRunning) return 'Läuft';
    if (systemStatusQuery.data?.hasUpdate)
      return `Verfügbar (${systemStatusQuery.data.behindCount || 0})`;
    if (systemStatusQuery.data?.isDirty) return 'Lokale Änderungen';
    return 'Aktuell';
  }, [systemStatusQuery.data]);

  const activityItems = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    for (const entry of (scheduleHistoryQuery.data || []).slice(0, 10)) {
      items.push({
        id: `schedule-${entry.id}`,
        title: `Aufgussplan v${entry.version} gespeichert`,
        description: entry.isActive ? 'Als aktiver Plan gesetzt' : 'Historische Planversion',
        tone: entry.isActive ? 'success' : 'neutral',
        timestamp: toValidDate(entry.createdAt),
        actor: 'Unbekannt',
      });
    }

    for (const item of [...media]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)) {
      items.push({
        id: `media-${item.id}`,
        title: `Medium hochgeladen: ${item.originalName}`,
        description: `${item.type} · ${formatFileSize(item.size)}`,
        tone: 'info',
        timestamp: toValidDate(item.createdAt),
        actor: item.user?.username || 'Unbekannt',
      });
    }

    for (const device of [...devices]
      .filter((d) => Boolean(d.pairedAt))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)) {
      items.push({
        id: `device-${device.id}`,
        title: `Gerät aktualisiert: ${device.name}`,
        description: `Modus: ${device.mode === 'override' ? 'Override' : 'Auto'}`,
        tone: device.mode === 'override' ? 'warning' : 'neutral',
        timestamp: toValidDate(device.updatedAt) || toValidDate(device.pairedAt),
        actor: device.user?.username || 'Unbekannt',
      });
    }

    if (liveState.activeEvent) {
      items.push({
        id: 'active-event',
        title: `Event aktiv: ${liveState.activeEvent.name}`,
        description: `Preset ${liveState.activeEvent.assignedPreset} ist live`,
        tone: 'info',
        timestamp: new Date(
          `${liveState.activeEvent.startDate}T${liveState.activeEvent.startTime}`
        ),
        actor: 'System',
      });
    }
    if (liveState.offlineDevices > 0) {
      items.push({
        id: 'offline-devices',
        title: `${liveState.offlineDevices} Gerät(e) offline`,
        description: 'Bitte Verbindungsstatus und Display-Clients prüfen',
        tone: 'warning',
        actor: 'System',
      });
    }
    if (liveState.pendingPairings > 0) {
      items.push({
        id: 'pending-pairings',
        title: `${liveState.pendingPairings} ausstehende Pairings`,
        description: 'Neue Bildschirme warten auf Freigabe',
        tone: 'warning',
        actor: 'System',
      });
    }
    if (systemStatusQuery.data?.hasUpdate) {
      items.push({
        id: 'system-update',
        title: 'Systemupdate verfügbar',
        description: `${systemStatusQuery.data.behindCount || 0} Commit(s) hinter origin/${systemStatusQuery.data.branch || 'main'}`,
        tone: 'warning',
        actor: 'System',
      });
    }
    if (settings) {
      items.push({
        id: 'settings-version',
        title: `Einstellungen v${settings.version} geladen`,
        description: `Design: ${settings.designStyle || 'modern-wellness'}`,
        tone: 'success',
        actor: 'System',
      });
    }

    return items
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, 30);
  }, [devices, liveState, media, scheduleHistoryQuery.data, settings, systemStatusQuery.data]);

  return {
    // Loading / error state
    isLoading,
    scheduleQuery,
    settingsQuery,
    devicesQuery,
    mediaQuery,
    backendHealthQuery,
    systemStatusQuery,

    // Raw data
    schedule,
    settings,
    devices,
    media,

    // Auth
    isAdmin,
    token,

    // WebSocket
    wsConnected,
    wsError,

    // Derived
    liveState,
    planQuality,
    mediaStats,
    eventStats,
    runningSlideshows,
    systemChecks,
    updateLabel,
    activityItems,
  };
}
