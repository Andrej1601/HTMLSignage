import type { Schedule } from './schedule.types';
import type { Settings } from './settings.types';

export type DeviceMode = 'auto' | 'override';

export type DeviceStatus = 'online' | 'offline';

export interface Device {
  id: string;
  name: string;
  pairingCode?: string | null;
  groupName?: string | null;
  mode: DeviceMode;
  maintenanceMode?: boolean;
  pairedBy?: string;
  pairedAt?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  status?: DeviceStatus; // Computed on frontend
  overrides?: DeviceOverride;
  snapshotUrl?: string | null;
  snapshotCapturedAt?: string | null;
  user?: {
    username: string;
  };
}

export interface DeviceOverride {
  id: string;
  deviceId: string;
  schedule?: Schedule;
  settings?: Settings;
}

export interface CreateDeviceRequest {
  name: string;
  groupName?: string | null;
  mode?: DeviceMode;
}

export interface UpdateDeviceRequest {
  name?: string;
  groupName?: string | null;
  mode?: DeviceMode;
  maintenanceMode?: boolean;
}

export interface DeviceControlCommand {
  action: 'reload' | 'restart' | 'clear-cache';
}

export interface BulkDeviceUpdateRequest {
  deviceIds: string[];
  updates: UpdateDeviceRequest;
}

export interface BulkDeviceControlRequest {
  deviceIds: string[];
  command: DeviceControlCommand;
}

export interface BulkDeviceActionResponse {
  ok: boolean;
  affectedCount: number;
  deviceIds: string[];
}

export function getDeviceGroupLabel(groupName?: string | null): string {
  const trimmed = typeof groupName === 'string' ? groupName.trim() : '';
  return trimmed.length > 0 ? trimmed : 'Ohne Gruppe';
}

// Helper functions
export function getDeviceStatus(lastSeen?: string): DeviceStatus {
  if (!lastSeen) return 'offline';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 1000 / 60;

  if (diffMinutes < 5) return 'online';
  return 'offline';
}

export function formatLastSeen(lastSeen?: string): string {
  if (!lastSeen) return 'Nie';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000 / 60);

  if (diffMinutes < 1) return 'Gerade eben';
  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`;

  return lastSeenDate.toLocaleDateString('de-DE');
}

export function getStatusColor(status: DeviceStatus): string {
  switch (status) {
    case 'online':
      return 'text-spa-success-dark bg-spa-success-light';
    case 'offline':
      return 'text-spa-warning-dark bg-spa-warning-light';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
  }
}

export function getModeLabel(mode: DeviceMode): string {
  switch (mode) {
    case 'auto':
      return 'Automatisch';
    case 'override':
      return 'Überschrieben';
  }
}
