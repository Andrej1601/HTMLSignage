import type { Schedule } from './schedule.types';
import type { Settings } from './settings.types';

export type DeviceMode = 'auto' | 'override';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

export interface Device {
  id: string;
  name: string;
  mode: DeviceMode;
  pairedBy?: string;
  pairedAt?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
  status?: DeviceStatus; // Computed on frontend
  overrides?: DeviceOverride;
}

export interface DeviceOverride {
  id: string;
  deviceId: string;
  schedule?: Schedule;
  settings?: Settings;
}

export interface CreateDeviceRequest {
  name: string;
  mode?: DeviceMode;
}

export interface UpdateDeviceRequest {
  name?: string;
  mode?: DeviceMode;
}

export interface DeviceControlCommand {
  action: 'reload' | 'restart' | 'clear-cache';
}

// Helper functions
export function getDeviceStatus(lastSeen?: string): DeviceStatus {
  if (!lastSeen) return 'unknown';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 1000 / 60;

  if (diffMinutes < 5) return 'online';
  if (diffMinutes < 30) return 'offline';
  return 'unknown';
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
      return 'text-green-600 bg-green-100';
    case 'offline':
      return 'text-orange-600 bg-orange-100';
    case 'unknown':
      return 'text-gray-600 bg-gray-100';
  }
}

export function getStatusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    case 'unknown':
      return 'Unbekannt';
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
