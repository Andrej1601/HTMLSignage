import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSchedule, useScheduleHistory } from '@/hooks/useSchedule';
import { useDevices } from '@/hooks/useDevices';
import { useMedia } from '@/hooks/useMedia';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  fetchApi,
  systemApi,
  type SystemJob,
} from '@/services/api';
import type { Media } from '@/types/media.types';
import {
} from '@/types/schedule.types';
import type { Device } from '@/types/device.types';
import {
  buildActivityItems,
  buildAttentionItems,
  buildDashboardLiveState,
  buildDeviceMonitoring,
  buildEventStats,
  buildMediaStats,
  buildPlanQuality,
  buildRunningSlideshows,
  buildSystemChecks,
  buildUpdateLabel,
  getActiveSystemJobs,
} from './dashboardData.utils';
export type {
  DashboardAttentionItem,
  DashboardDeviceMonitorItem,
  DashboardDeviceMonitoringWarning,
  DashboardEventStats,
  DashboardLiveState,
  DashboardMediaStats,
  DashboardPlanQuality,
  DashboardSystemChecks,
} from './dashboardData.types';

const EMPTY_DEVICES: Device[] = [];
const EMPTY_MEDIA: Media[] = [];
const EMPTY_SYSTEM_JOBS: SystemJob[] = [];

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
  const devices = devicesQuery.data ?? EMPTY_DEVICES;
  const media = mediaQuery.data ?? EMPTY_MEDIA;

  const backendHealthQuery = useQuery({
    queryKey: ['dashboard-health'],
    queryFn: async (): Promise<{ status: string; timestamp?: string }> => fetchApi('/health'),
    refetchInterval: 30000,
  });

  const runtimeStatusQuery = useQuery({
    queryKey: ['dashboard-runtime-status'],
    queryFn: () => systemApi.getRuntimeStatus(token!),
    enabled: Boolean(token),
    refetchInterval: 30000,
  });

  const runtimeHistoryQuery = useQuery({
    queryKey: ['dashboard-runtime-history'],
    queryFn: () => systemApi.getRuntimeHistory(token!, 24),
    enabled: Boolean(token),
    refetchInterval: 5 * 60 * 1000,
  });

  const systemStatusQuery = useQuery({
    queryKey: ['dashboard-system-update-status'],
    queryFn: () => systemApi.getReleases(token!),
    enabled: isAdmin && Boolean(token),
    refetchInterval: 60000,
  });

  const auditLogQuery = useQuery({
    queryKey: ['dashboard-audit-log'],
    queryFn: () => systemApi.getAuditLog(token!, 16),
    enabled: isAdmin && Boolean(token),
    refetchInterval: 15000,
  });

  const systemJobsQuery = useQuery({
    queryKey: ['dashboard-system-jobs'],
    queryFn: () => systemApi.listJobs(token!, 6),
    enabled: isAdmin && Boolean(token),
    refetchInterval: 5000,
  });

  const isLoading =
    scheduleQuery.isLoading ||
    settingsQuery.isLoading ||
    devicesQuery.isLoading ||
    mediaQuery.isLoading;

  const liveState = useMemo(
    () => buildDashboardLiveState(devices, schedule, settings),
    [devices, schedule, settings],
  );

  const planQuality = useMemo(
    () => buildPlanQuality(schedule),
    [schedule],
  );

  const mediaStats = useMemo(
    () => buildMediaStats(media),
    [media],
  );

  const eventStats = useMemo(
    () => buildEventStats(settings, liveState.activeEvent),
    [settings, liveState.activeEvent],
  );

  const runningSlideshows = useMemo(
    () => buildRunningSlideshows(liveState.onlinePairedDevices, settings),
    [liveState.onlinePairedDevices, settings],
  );

  const deviceMonitoring = useMemo(
    () => buildDeviceMonitoring(liveState.pairedDevices, media, settings),
    [liveState.pairedDevices, media, settings],
  );

  const runtimeStatus = runtimeStatusQuery.data || null;
  const runtimeHistory = runtimeHistoryQuery.data || null;

  const systemChecks = useMemo(() => buildSystemChecks({
    backendHealthError: backendHealthQuery.isError,
    backendHealthStatus: backendHealthQuery.data?.status,
    dataError: Boolean(scheduleQuery.error || settingsQuery.error || devicesQuery.error || mediaQuery.error),
    hasCoreData: Boolean(schedule && settings),
    wsConnected,
    wsError,
    isAdmin,
    systemStatusError: systemStatusQuery.isError,
    systemStatusData: systemStatusQuery.data,
  }), [
    backendHealthQuery.data?.status,
    backendHealthQuery.isError,
    devicesQuery.error,
    isAdmin,
    mediaQuery.error,
    schedule,
    scheduleQuery.error,
    settings,
    settingsQuery.error,
    systemStatusQuery.data,
    systemStatusQuery.isError,
    wsConnected,
    wsError,
  ]);

  const updateLabel = useMemo(
    () => buildUpdateLabel(systemStatusQuery.data),
    [systemStatusQuery.data],
  );

  const systemJobs = systemJobsQuery.data?.items ?? EMPTY_SYSTEM_JOBS;
  const activeSystemJobs = useMemo(
    () => getActiveSystemJobs(systemJobs),
    [systemJobs],
  );

  const attentionItems = useMemo(
    () => buildAttentionItems({
      runtimeStatus,
      liveState,
      planQuality,
      nextEvent: eventStats.nextEvent,
      activeSystemJobs,
    }),
    [activeSystemJobs, eventStats.nextEvent, liveState, planQuality, runtimeStatus],
  );

  const activityItems = useMemo(
    () => buildActivityItems({
      auditItems: auditLogQuery.data?.items,
      scheduleHistory: scheduleHistoryQuery.data,
      media,
      devices,
      liveState,
      runtimeStatus,
      systemStatus: systemStatusQuery.data,
      settings,
    }),
    [auditLogQuery.data?.items, devices, liveState, media, runtimeStatus, scheduleHistoryQuery.data, settings, systemStatusQuery.data],
  );

  return {
    isLoading,
    scheduleQuery,
    settingsQuery,
    devicesQuery,
    mediaQuery,
    backendHealthQuery,
    runtimeStatusQuery,
    runtimeHistoryQuery,
    systemStatusQuery,
    schedule,
    settings,
    devices,
    media,
    isAdmin,
    token,
    wsConnected,
    wsError,
    liveState,
    planQuality,
    mediaStats,
    eventStats,
    runningSlideshows,
    deviceMonitoring,
    runtimeStatus,
    runtimeHistory,
    systemChecks,
    updateLabel,
    systemJobs,
    activeSystemJobs,
    attentionItems,
    activityItems,
  };
}
