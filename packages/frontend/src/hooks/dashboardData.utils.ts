import type { ActivityItem } from '@/components/Dashboard/ActivityFeedWidget';
import type { DeviceSlideshowRow, RunningSlideshowGroup } from '@/hooks/dashboardData.types';
import type { StatusTone } from '@/components/StatusBadge';
import type {
  AuditLogItem,
  SystemJob,
  SystemReleasesResponse,
  SystemRuntimeStatusResponse,
} from '@/services/api';
import { formatLastSeen, getModeLabel } from '@/types/device.types';
import type { Device } from '@/types/device.types';
import { formatFileSize, type Media } from '@/types/media.types';
import { resolveLivePresetKey, type Schedule } from '@/types/schedule.types';
import {
  getActiveEvent,
  type Event,
  type Settings,
} from '@/types/settings.types';
import {
  createDefaultSlideshowConfig,
  getEnabledSlides,
  getZonesForLayout,
  type SlideshowConfig,
} from '@/types/slideshow.types';
import { ONLINE_THRESHOLD_MINUTES } from '@/utils/constants';
import { getMinutesSince, toValidDate } from '@/utils/dateUtils';
import { isPlainRecord } from '@/utils/objectUtils';
import { getDeviceOverrideSettings, hasDeviceOverrides } from '@/utils/deviceUtils';
import { normalizeAudioSettings } from '@/utils/audioUtils';
import { resolveEffectiveDeviceSettings } from '@/utils/displaySettings';
import {
  getDisplayAppearanceLabel,
  getScheduleDesignStyleLabel,
} from '@/config/displayDesignStyles';
import { formatAuditActionLabel, formatAuditDescription, getAuditActionMeta, summarizeAuditDetails } from '@/utils/auditLog';
import type {
  DashboardActivityBuildInput,
  DashboardAttentionItem,
  DashboardDeviceMonitorItem,
  DashboardDeviceMonitoringWarning,
  DashboardEventStats,
  DashboardLiveState,
  DashboardMediaStats,
  DashboardPlanQuality,
  DashboardSystemChecks,
} from './dashboardData.types';

export function getLatestMediaItem(media: Media[]): Media | null {
  if (media.length === 0) return null;
  return media.reduce((latest, current) =>
    new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest,
  );
}

export function isSlideshowConfig(value: unknown): value is SlideshowConfig {
  if (!isPlainRecord(value)) return false;
  return typeof value.layout === 'string' && Array.isArray(value.slides);
}

function getSlideshowFingerprint(config: SlideshowConfig): string {
  const normalizedSlides = [...(config.slides || [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((slide) => ({
      type: slide.type,
      enabled: slide.enabled,
      duration: slide.duration,
      order: slide.order,
      zoneId: slide.zoneId || 'main',
      saunaId: slide.saunaId || null,
      mediaId: slide.mediaId || null,
      infoId: slide.infoId || null,
      transition: slide.transition || 'none',
      videoPlayback: slide.videoPlayback || null,
      mediaFit: slide.mediaFit || null,
    }));

  return JSON.stringify({
    layout: config.layout,
    defaultDuration: config.defaultDuration,
    defaultTransition: config.defaultTransition,
    enableTransitions: config.enableTransitions,
    slides: normalizedSlides,
  });
}

export function getDeviceSlideshowOverride(device: Device): SlideshowConfig | null {
  const overrideSettings = getDeviceOverrideSettings(device);
  const slideshow = overrideSettings.slideshow;
  if (!isSlideshowConfig(slideshow)) return null;
  return slideshow;
}

function getConnectivityState(lastSeen?: string): {
  label: string;
  tone: StatusTone;
  sortRank: number;
} {
  const minutes = getMinutesSince(lastSeen);
  if (minutes === null) {
    return { label: 'Kein Heartbeat', tone: 'warning', sortRank: 0 };
  }
  if (minutes < ONLINE_THRESHOLD_MINUTES) {
    return { label: 'Online', tone: 'success', sortRank: 3 };
  }
  if (minutes < 30) {
    return { label: 'Heartbeat spät', tone: 'warning', sortRank: 2 };
  }
  return { label: 'Offline', tone: 'danger', sortRank: 1 };
}

function getAudioLabel(rawSettings: Settings, media: Media[]): {
  label: string;
  tone: StatusTone;
  missingSource: boolean;
} {
  const audio = normalizeAudioSettings(rawSettings.audio);
  if (!audio.enabled) {
    return { label: 'Aus', tone: 'neutral', missingSource: false };
  }

  if (audio.mediaId) {
    const mediaItem = media.find((item) => item.id === audio.mediaId);
    if (mediaItem) {
      return {
        label: mediaItem.originalName,
        tone: 'info',
        missingSource: false,
      };
    }
  }

  if (audio.src) {
    const parts = audio.src.split('/').filter(Boolean);
    const fileName = decodeURIComponent(parts[parts.length - 1] || 'Externe Quelle');
    return {
      label: fileName,
      tone: 'info',
      missingSource: false,
    };
  }

  return {
    label: 'Quelle fehlt',
    tone: 'danger',
    missingSource: true,
  };
}

export function getWarningTone(level: 'warning' | 'danger'): StatusTone {
  return level === 'danger' ? 'danger' : 'warning';
}

function mapAuditItemToActivity(item: AuditLogItem): ActivityItem {
  const meta = getAuditActionMeta(item.action);
  return {
    id: `audit-${item.id}`,
    title: formatAuditActionLabel(item.action),
    description: formatAuditDescription(item.action, item.resource, item.details),
    tone: meta.tone,
    timestamp: toValidDate(item.timestamp),
    actor: item.user?.username || 'System',
    category: meta.category,
    details: summarizeAuditDetails(item.details),
  };
}

export function buildDashboardLiveState(
  devices: Device[],
  schedule: Schedule | null | undefined,
  settings: Settings | null | undefined,
): DashboardLiveState {
  const now = new Date();
  const pairedDevices = devices.filter((device) => Boolean(device.pairedAt));
  const onlinePairedDevices = pairedDevices.filter((device) => {
    const minutes = getMinutesSince(device.lastSeen);
    return minutes !== null && minutes < ONLINE_THRESHOLD_MINUTES;
  });
  const neverSeenDevices = pairedDevices.filter((device) => getMinutesSince(device.lastSeen) === null).length;
  const onlineDevices = onlinePairedDevices.length;
  const offlineDevices = Math.max(pairedDevices.length - onlineDevices - neverSeenDevices, 0);
  const overrideModeDevices = pairedDevices.filter((device) => device.mode === 'override').length;
  const autoModeDevices = pairedDevices.length - overrideModeDevices;
  const devicesWithOverrides = pairedDevices.filter(hasDeviceOverrides).length;
  const activeOverrideDevices = pairedDevices.filter(
    (device) => device.mode === 'override' && hasDeviceOverrides(device),
  ).length;
  const activeEvent = settings ? getActiveEvent(settings, now) : null;
  const activePreset = schedule ? resolveLivePresetKey(schedule, settings ?? undefined, now) : null;
  const pendingPairings = devices.length - pairedDevices.length;

  return {
    pairedDevices,
    onlinePairedDevices,
    pendingPairings,
    onlineDevices,
    offlineDevices,
    neverSeenDevices,
    overrideModeDevices,
    autoModeDevices,
    devicesWithOverrides,
    activeOverrideDevices,
    activeEvent,
    activePreset,
  };
}

export function buildPlanQuality(schedule: Schedule | null | undefined): DashboardPlanQuality {
  if (!schedule?.presets) {
    return { totalRows: 0, emptyRows: 0, inconsistentRows: 0, duplicateTimeRows: 0, fillRate: 0 };
  }

  let totalRows = 0;
  let emptyRows = 0;
  let inconsistentRows = 0;
  let duplicateTimeRows = 0;

  for (const preset of Object.values(schedule.presets)) {
    const seenTimes = new Set<string>();
    for (const row of preset.rows) {
      totalRows += 1;
      if (!(row.entries || []).some((entry) => Boolean(entry?.title?.trim()))) emptyRows += 1;
      if ((row.entries?.length || 0) !== preset.saunas.length) inconsistentRows += 1;
      if (seenTimes.has(row.time)) duplicateTimeRows += 1;
      else seenTimes.add(row.time);
    }
  }

  const fillRate = totalRows > 0 ? Math.round(((totalRows - emptyRows) / totalRows) * 100) : 0;
  return { totalRows, emptyRows, inconsistentRows, duplicateTimeRows, fillRate };
}

export function buildMediaStats(media: Media[]): DashboardMediaStats {
  const images = media.filter((item) => item.type === 'image').length;
  const audioCount = media.filter((item) => item.type === 'audio').length;
  const videos = media.filter((item) => item.type === 'video').length;
  const totalSize = media.reduce((sum, item) => sum + item.size, 0);
  const latestMedia = getLatestMediaItem(media);
  return { total: media.length, images, audio: audioCount, videos, totalSize, latestMedia };
}

export function buildEventStats(
  settings: Settings | null | undefined,
  activeEvent: Event | null,
): DashboardEventStats {
  const events = settings?.events || [];
  const now = new Date();
  const nextEvent = events
    .filter((event) => event.isActive && new Date(`${event.startDate}T${event.startTime}`) > now)
    .sort((a, b) =>
      new Date(`${a.startDate}T${a.startTime}`).getTime() -
      new Date(`${b.startDate}T${b.startTime}`).getTime(),
    )[0] || null;

  return {
    total: events.length,
    enabled: events.filter((event) => event.isActive).length,
    activeName: activeEvent?.name || null,
    nextEvent,
  };
}

export function buildRunningSlideshows(
  onlinePairedDevices: Device[],
  settings: Settings | null | undefined,
): RunningSlideshowGroup[] {
  const globalConfig = settings?.slideshow || createDefaultSlideshowConfig();
  const groups: RunningSlideshowGroup[] = [];
  const overrideGroups = new Map<string, RunningSlideshowGroup>();

  const globalDeviceNames = onlinePairedDevices
    .filter((device) => !(device.mode === 'override' && getDeviceSlideshowOverride(device)))
    .map((device) => device.name);

  groups.push({
    id: 'global',
    source: 'global',
    title: 'Globale Slideshow',
    config: globalConfig,
    slides: getEnabledSlides(globalConfig),
    deviceNames: globalDeviceNames,
  });

  for (const device of onlinePairedDevices) {
    if (device.mode !== 'override') continue;
    const overrideConfig = getDeviceSlideshowOverride(device);
    if (!overrideConfig) continue;
    const fingerprint = getSlideshowFingerprint(overrideConfig);
    const existing = overrideGroups.get(fingerprint);
    if (existing) {
      existing.deviceNames.push(device.name);
      continue;
    }

    overrideGroups.set(fingerprint, {
      id: `override-${overrideGroups.size + 1}`,
      source: 'override',
      title: `Override Slideshow ${overrideGroups.size + 1}`,
      config: overrideConfig,
      slides: getEnabledSlides(overrideConfig),
      deviceNames: [device.name],
    });
  }

  return [...groups, ...Array.from(overrideGroups.values())];
}

function countActiveSlides(config: SlideshowConfig): number {
  const enabledSlides = getEnabledSlides(config);
  const zones = getZonesForLayout(config.layout);
  const zoneIds = new Set(zones.map((z) => z.id));
  // Only count slides that belong to a zone of the active layout
  return enabledSlides.filter((s) => zoneIds.has(s.zoneId || 'main')).length;
}

export function buildDeviceSlideshowRows(
  pairedDevices: Device[],
  settings: Settings | null | undefined,
): DeviceSlideshowRow[] {
  const globalConfig = settings?.slideshow || createDefaultSlideshowConfig();
  const globalSlideCount = countActiveSlides(globalConfig);

  return pairedDevices.map((device) => {
    const overrideConfig = getDeviceSlideshowOverride(device);
    const hasDeviceSlideshow = Boolean(device.slideshowId && device.slideshow);
    const hasOverride = device.mode === 'override' && overrideConfig !== null;
    const activeConfig = hasOverride ? overrideConfig! : globalConfig;
    const slideCount = hasOverride ? countActiveSlides(activeConfig) : globalSlideCount;
    const minutes = getMinutesSince(device.lastSeen);
    const isOnline = minutes !== null && minutes < ONLINE_THRESHOLD_MINUTES;

    const slideshowTitle = hasDeviceSlideshow
      ? device.slideshow!.name
      : hasOverride
        ? 'Override Slideshow'
        : 'Globale Slideshow';

    return {
      deviceId: device.id,
      deviceName: device.name,
      snapshotUrl: device.snapshotUrl || null,
      snapshotCapturedAt: device.snapshotCapturedAt || null,
      slideshowTitle,
      slideCount,
      lastSeen: device.lastSeen || null,
      isOnline,
      editorTarget: hasDeviceSlideshow ? `slideshow:${device.slideshowId}` : hasOverride ? `device:${device.id}` : 'global',
    };
  });
}

export function buildDeviceMonitoring(
  pairedDevices: Device[],
  media: Media[],
  settings: Settings | null | undefined,
): DashboardDeviceMonitorItem[] {
  const now = new Date();

  return pairedDevices
    .map((device) => {
      const connectivity = getConnectivityState(device.lastSeen);
      const {
        settings: effectiveDeviceSettings,
        activeEvent,
        hasOverrideSettings,
        hasOverrideSlideshow,
      } = resolveEffectiveDeviceSettings(settings ?? undefined, device, now);
      const audioState = getAudioLabel(effectiveDeviceSettings, media);

      const eventUsesSlideshowOverride = Boolean(
        activeEvent?.settingsOverrides &&
        isSlideshowConfig(activeEvent.settingsOverrides.slideshow),
      );

      const slideshowLabel = eventUsesSlideshowOverride
        ? `Event-Layout${activeEvent ? ` · ${activeEvent.name}` : ''}`
        : hasOverrideSlideshow && device.mode === 'override'
          ? 'Override-Slideshow'
          : 'Globale Slideshow';

      const slideshowTone: StatusTone = eventUsesSlideshowOverride
        ? 'info'
        : hasOverrideSlideshow && device.mode === 'override'
          ? 'warning'
          : 'success';

      const warnings: DashboardDeviceMonitoringWarning[] = [];

      if (!device.lastSeen) {
        warnings.push({ label: 'Noch kein Heartbeat', tone: 'warning' });
      } else {
        const minutes = getMinutesSince(device.lastSeen);
        if (minutes !== null && minutes >= 30) {
          warnings.push({ label: 'Heartbeat veraltet', tone: 'danger' });
        } else if (minutes !== null && minutes >= ONLINE_THRESHOLD_MINUTES) {
          warnings.push({ label: 'Heartbeat verspätet', tone: 'warning' });
        }
      }

      if (device.mode === 'override' && !hasOverrideSettings) {
        warnings.push({ label: 'Override ohne Inhalt', tone: 'warning' });
      }

      if (audioState.missingSource) {
        warnings.push({ label: 'Audio ohne Quelle', tone: 'danger' });
      }

      return {
        id: device.id,
        name: device.name,
        snapshotUrl: device.snapshotUrl || null,
        snapshotCapturedAt: device.snapshotCapturedAt || null,
        statusLabel: connectivity.label,
        statusTone: connectivity.tone,
        lastSeenLabel: formatLastSeen(device.lastSeen),
        modeLabel: getModeLabel(device.mode),
        modeTone: (device.mode === 'override' ? 'info' : 'success') as StatusTone,
        slideshowLabel,
        slideshowTone,
        eventLabel: activeEvent ? `${activeEvent.name} bis ${activeEvent.endTime || '23:59'}` : 'Kein Event aktiv',
        eventTone: (activeEvent ? 'info' : 'neutral') as StatusTone,
        audioLabel: audioState.label,
        audioTone: audioState.tone,
        warnings,
        sortRank: connectivity.sortRank,
      };
    })
    .sort((a, b) => {
      if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
      if (a.warnings.length !== b.warnings.length) return b.warnings.length - a.warnings.length;
      return a.name.localeCompare(b.name, 'de-DE');
    });
}

interface BuildSystemChecksInput {
  backendHealthError: boolean;
  backendHealthStatus?: string;
  dataError: boolean;
  hasCoreData: boolean;
  wsConnected: boolean;
  wsError: unknown;
  isAdmin: boolean;
  systemStatusError: boolean;
  systemStatusData?: SystemReleasesResponse | null;
}

export function buildSystemChecks(input: BuildSystemChecksInput): DashboardSystemChecks {
  const {
    backendHealthError,
    backendHealthStatus,
    dataError,
    hasCoreData,
    wsConnected,
    wsError,
    isAdmin,
    systemStatusError,
    systemStatusData,
  } = input;

  const backendTone: StatusTone =
    backendHealthError ? 'danger'
    : backendHealthStatus === 'ok' ? 'success'
    : 'warning';

  const dataTone: StatusTone =
    dataError ? 'danger'
    : hasCoreData ? 'success' : 'warning';

  const websocketTone: StatusTone =
    wsConnected ? 'success' : wsError ? 'danger' : 'warning';

  const updateTone: StatusTone =
    !isAdmin ? 'neutral'
    : systemStatusError ? 'danger'
    : systemStatusData?.isRunning ? 'info'
    : systemStatusData?.hasUpdate ? 'warning'
    : systemStatusData?.isDirty ? 'warning'
    : 'success';

  return { backendTone, dataTone, websocketTone, updateTone };
}

export function buildUpdateLabel(systemStatusData?: SystemReleasesResponse | null): string {
  if (systemStatusData?.isRunning) return 'Läuft';
  if (systemStatusData?.hasUpdate) {
    return `${systemStatusData.latestRelease?.tag || 'Update'} verfügbar`;
  }
  if (systemStatusData?.isDirty) return 'Lokale Änderungen';
  return `v${systemStatusData?.currentVersion || '?'}`;
}

export function getActiveSystemJobs(systemJobs: SystemJob[]): SystemJob[] {
  return systemJobs.filter((job) => job.status === 'queued' || job.status === 'running');
}

interface BuildAttentionItemsInput {
  runtimeStatus: SystemRuntimeStatusResponse | null;
  liveState: DashboardLiveState;
  planQuality: DashboardPlanQuality;
  nextEvent: Event | null;
  activeSystemJobs: SystemJob[];
}

export function buildAttentionItems(input: BuildAttentionItemsInput): DashboardAttentionItem[] {
  const {
    runtimeStatus,
    liveState,
    planQuality,
    nextEvent,
    activeSystemJobs,
  } = input;

  const items: Array<DashboardAttentionItem & { priority: number }> = [];

  for (const warning of runtimeStatus?.warnings || []) {
    const href =
      warning.category === 'devices' ? '/devices'
      : warning.category === 'media' ? '/media'
      : '/settings';

    items.push({
      id: `runtime-${warning.id}`,
      title: warning.title,
      detail: warning.detail,
      tone: getWarningTone(warning.level),
      href,
      actionLabel:
        warning.category === 'devices' ? 'Geräte prüfen'
        : warning.category === 'media' ? 'Medien prüfen'
        : 'System öffnen',
      area:
        warning.category === 'devices' ? 'devices'
        : warning.category === 'media' ? 'media'
        : 'settings',
      priority: warning.level === 'danger' ? 0 : 1,
    });
  }

  if (liveState.pendingPairings > 0) {
    items.push({
      id: 'pending-pairings',
      title: `${liveState.pendingPairings} Pairing${liveState.pendingPairings === 1 ? '' : 's'} offen`,
      detail: 'Neue Displays warten auf Freigabe und erscheinen noch nicht im Live-Betrieb.',
      tone: 'warning',
      href: '/devices',
      actionLabel: 'Freigaben öffnen',
      area: 'devices',
      priority: 1,
    });
  }

  if (planQuality.duplicateTimeRows > 0 || planQuality.inconsistentRows > 0) {
    const problems = [
      planQuality.duplicateTimeRows > 0 ? `${planQuality.duplicateTimeRows} doppelte Zeit${planQuality.duplicateTimeRows === 1 ? '' : 'en'}` : null,
      planQuality.inconsistentRows > 0 ? `${planQuality.inconsistentRows} unvollständige Zeile${planQuality.inconsistentRows === 1 ? '' : 'n'}` : null,
    ].filter(Boolean).join(' · ');

    items.push({
      id: 'plan-quality',
      title: 'Aufgussplan braucht Pflege',
      detail: problems,
      tone: 'warning',
      href: '/schedule',
      actionLabel: 'Plan prüfen',
      area: 'schedule',
      priority: 1,
    });
  }

  if (liveState.activeOverrideDevices > 0) {
    items.push({
      id: 'active-overrides',
      title: `${liveState.activeOverrideDevices} Override${liveState.activeOverrideDevices === 1 ? '' : 's'} aktiv`,
      detail: 'Ein Teil der Geräte läuft aktuell nicht auf der globalen Slideshow.',
      tone: 'info',
      href: '/slideshow',
      actionLabel: 'Overrides prüfen',
      area: 'slideshow',
      priority: 2,
    });
  }

  if (!liveState.activeEvent && nextEvent) {
    items.push({
      id: 'next-event',
      title: `Nächstes Event: ${nextEvent.name}`,
      detail: `${nextEvent.startDate} · ${nextEvent.startTime}`,
      tone: 'info',
      href: '/settings',
      actionLabel: 'Event öffnen',
      area: 'settings',
      priority: 2,
    });
  }

  for (const job of activeSystemJobs) {
    items.push({
      id: `job-${job.id}`,
      title: job.title,
      detail: job.progress?.message || 'Hintergrundjob läuft',
      tone: 'info',
      href: '/settings',
      actionLabel: 'Systemjobs ansehen',
      area: 'settings',
      priority: 2,
    });
  }

  return items
    .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'de-DE'))
    .slice(0, 6)
    .map(({ priority: _priority, ...item }) => item);
}

function buildFallbackActivities(input: Omit<DashboardActivityBuildInput, 'auditItems'>): ActivityItem[] {
  const {
    scheduleHistory,
    media,
    devices,
    liveState,
    runtimeStatus,
    systemStatus,
    settings,
  } = input;
  const items: ActivityItem[] = [];

  for (const entry of (scheduleHistory || []).slice(0, 10)) {
    const date = toValidDate(entry.createdAt);
    const dateStr = date
      ? `${date.toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })}, ${date.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Unbekannt';

    items.push({
      id: `schedule-${entry.id}`,
      title: `Plan vom ${dateStr}`,
      description: entry.isActive ? 'Aktiver Plan' : 'Historische Version',
      tone: entry.isActive ? 'success' : 'neutral',
      timestamp: date,
      actor: 'Unbekannt',
      category: 'einstellungen',
      details: entry.changeSummary ?? undefined,
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
      category: 'media',
    });
  }

  for (const device of [...devices]
    .filter((entry) => Boolean(entry.pairedAt))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)) {
    items.push({
      id: `device-${device.id}`,
      title: `Gerät aktualisiert: ${device.name}`,
      description: `Modus: ${device.mode === 'override' ? 'Override' : 'Auto'}`,
      tone: device.mode === 'override' ? 'warning' : 'neutral',
      timestamp: toValidDate(device.updatedAt) || toValidDate(device.pairedAt),
      actor: device.user?.username || 'Unbekannt',
      category: 'device',
    });
  }

  if (liveState.activeEvent) {
    items.push({
      id: 'active-event',
      title: `Event aktiv: ${liveState.activeEvent.name}`,
      description: `Preset ${liveState.activeEvent.assignedPreset} ist live`,
      tone: 'info',
      timestamp: new Date(`${liveState.activeEvent.startDate}T${liveState.activeEvent.startTime}`),
      actor: 'System',
      category: 'systemjobs',
    });
  }

  if (liveState.offlineDevices > 0) {
    items.push({
      id: 'offline-devices',
      title: `${liveState.offlineDevices} Gerät(e) offline`,
      description: 'Bitte Verbindungsstatus und Display-Clients prüfen',
      tone: 'warning',
      actor: 'System',
      category: 'systemjobs',
    });
  }

  if (liveState.pendingPairings > 0) {
    items.push({
      id: 'pending-pairings',
      title: `${liveState.pendingPairings} ausstehende Pairings`,
      description: 'Neue Bildschirme warten auf Freigabe',
      tone: 'warning',
      actor: 'System',
      category: 'systemjobs',
    });
  }

  for (const warning of (runtimeStatus?.warnings || []).slice(0, 4)) {
    items.push({
      id: `runtime-${warning.id}`,
      title: warning.title,
      description: warning.detail,
      tone: getWarningTone(warning.level),
      timestamp: toValidDate(runtimeStatus?.checkedAt),
      actor: 'System',
      category: 'systemjobs',
    });
  }

  if (systemStatus?.hasUpdate && systemStatus.latestRelease) {
    items.push({
      id: 'system-update',
      title: 'Systemupdate verfügbar',
      description: `${systemStatus.latestRelease.tag} — ${systemStatus.latestRelease.name}`,
      tone: 'warning',
      actor: 'System',
      category: 'systemjobs',
    });
  }

  if (settings) {
    items.push({
      id: 'settings-version',
      title: `Einstellungen v${settings.version} geladen`,
      description: `Design: ${getDisplayAppearanceLabel(settings.displayAppearance)} · ${getScheduleDesignStyleLabel(settings.designStyle || 'modern-wellness')}`,
      tone: 'success',
      actor: 'System',
      category: 'systemjobs',
    });
  }

  return items
    .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
    .slice(0, 30);
}

export function buildActivityItems(input: DashboardActivityBuildInput): ActivityItem[] {
  if (input.auditItems && input.auditItems.length > 0) {
    return input.auditItems.map(mapAuditItemToActivity);
  }

  return buildFallbackActivities(input);
}
