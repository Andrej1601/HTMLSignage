import type { ActivityItem } from '@/components/Dashboard/ActivityFeedWidget';
import type { StatusTone } from '@/components/StatusBadge';
import type { Media } from '@/types/media.types';
import type { PresetKey } from '@/types/schedule.types';
import type { Event } from '@/types/settings.types';
import type { SlideshowConfig, SlideConfig } from '@/types/slideshow.types';

export interface RunningSlideshowGroup {
  id: string;
  source: 'global' | 'override';
  title: string;
  config: SlideshowConfig;
  slides: SlideConfig[];
  deviceNames: string[];
}

export interface DeviceSlideshowRow {
  deviceId: string;
  deviceName: string;
  snapshotUrl: string | null;
  snapshotCapturedAt: string | null;
  slideshowTitle: string;
  slideCount: number;
  lastSeen: string | null;
  isOnline: boolean;
  /** Wartungsmodus aktiv — Anzeigeflag für die Gerät-Übersicht. */
  maintenanceMode: boolean;
  /** Gruppen-Label für Sortierung/Anzeige (`'Ohne Gruppe'` wenn leer). */
  groupName: string | null;
  /** Frisch gepairtes Gerät, das noch nie einen Heartbeat geschickt hat. */
  neverSeen: boolean;
  /** 'global' or 'device:<id>' — used for deep-linking to the slideshow editor */
  editorTarget: string;
}

export interface DashboardSystemChecks {
  backendTone: StatusTone;
  dataTone: StatusTone;
  websocketTone: StatusTone;
  updateTone: StatusTone;
}

export interface DashboardLiveState {
  pairedDevices: import('@/types/device.types').Device[];
  onlinePairedDevices: import('@/types/device.types').Device[];
  pendingPairings: number;
  onlineDevices: number;
  offlineDevices: number;
  neverSeenDevices: number;
  overrideModeDevices: number;
  autoModeDevices: number;
  devicesWithOverrides: number;
  activeOverrideDevices: number;
  activeEvent: Event | null;
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

export interface DashboardEventStats {
  total: number;
  enabled: number;
  activeName: string | null;
  nextEvent: Event | null;
}

export interface DashboardDeviceMonitoringWarning {
  label: string;
  tone: StatusTone;
}

export interface DashboardDeviceMonitorItem {
  id: string;
  name: string;
  snapshotUrl: string | null;
  snapshotCapturedAt: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  lastSeenLabel: string;
  modeLabel: string;
  modeTone: StatusTone;
  slideshowLabel: string;
  slideshowTone: StatusTone;
  eventLabel: string;
  eventTone: StatusTone;
  audioLabel: string;
  audioTone: StatusTone;
  warnings: DashboardDeviceMonitoringWarning[];
  sortRank: number;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  detail: string;
  tone: StatusTone;
  href: string;
  actionLabel: string;
  area: 'devices' | 'schedule' | 'slideshow' | 'settings' | 'media';
}

export interface DashboardActivityBuildInput {
  auditItems?: import('@/services/api').AuditLogItem[];
  scheduleHistory?: import('@/services/api').ScheduleHistoryItem[];
  media: Media[];
  devices: import('@/types/device.types').Device[];
  liveState: DashboardLiveState;
  runtimeStatus: import('@/services/api').SystemRuntimeStatusResponse | null;
  systemStatus: import('@/services/api').SystemReleasesResponse | null | undefined;
  settings: import('@/types/settings.types').Settings | null | undefined;
}

export type DashboardActivityFeed = ActivityItem[];
