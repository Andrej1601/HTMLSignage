import axios from 'axios';
import type { Schedule, ScheduleResponse } from '@/types/schedule.types';
import type { Device, CreateDeviceRequest, UpdateDeviceRequest, DeviceControlCommand } from '@/types/device.types';
import type { Media, MediaFilter } from '@/types/media.types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Schedule API
export const scheduleApi = {
  // Get current schedule
  getSchedule: async (): Promise<Schedule> => {
    const { data } = await api.get<ScheduleResponse>('/schedule');
    return data;
  },

  // Save schedule
  saveSchedule: async (schedule: Schedule): Promise<{ ok: boolean; version: number }> => {
    const { data } = await api.post('/schedule', schedule);
    return data;
  },

  // Get schedule history
  getHistory: async (limit = 10) => {
    const { data } = await api.get('/schedule/history', { params: { limit } });
    return data;
  },
};

// Settings API
export const settingsApi = {
  getSettings: async () => {
    const { data } = await api.get('/settings');
    return data;
  },

  saveSettings: async (settings: any) => {
    const { data } = await api.post('/settings', settings);
    return data;
  },
};

// Devices API
export const devicesApi = {
  // Get all devices
  getDevices: async (): Promise<Device[]> => {
    const { data } = await api.get('/devices');
    return data;
  },

  // Get single device
  getDevice: async (id: string): Promise<Device> => {
    const { data } = await api.get(`/devices/${id}`);
    return data;
  },

  // Create new device (pairing)
  createDevice: async (device: CreateDeviceRequest): Promise<Device> => {
    const { data } = await api.post('/devices', device);
    return data;
  },

  // Update device
  updateDevice: async (id: string, updates: UpdateDeviceRequest): Promise<Device> => {
    const { data } = await api.patch(`/devices/${id}`, updates);
    return data;
  },

  // Delete device
  deleteDevice: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/devices/${id}`);
    return data;
  },

  // Send heartbeat (device pings this)
  sendHeartbeat: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/devices/${id}/heartbeat`);
    return data;
  },

  // Send control command (reload, restart, clear-cache)
  sendCommand: async (id: string, command: DeviceControlCommand): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/devices/${id}/control`, command);
    return data;
  },

  // Set device overrides
  setOverrides: async (id: string, overrides: { schedule?: any; settings?: any }): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/devices/${id}/overrides`, overrides);
    return data;
  },

  // Clear device overrides
  clearOverrides: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/devices/${id}/overrides`);
    return data;
  },
};

// Media API
export const mediaApi = {
  // Get all media
  getMedia: async (filter?: MediaFilter): Promise<Media[]> => {
    const params = new URLSearchParams();
    if (filter?.type) params.append('type', filter.type);
    if (filter?.search) params.append('search', filter.search);

    const { data } = await api.get('/media', { params });
    return data;
  },

  // Get single media item
  getMediaItem: async (id: string): Promise<Media> => {
    const { data } = await api.get(`/media/${id}`);
    return data;
  },

  // Upload media file
  uploadMedia: async (file: File): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  // Delete media
  deleteMedia: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await api.delete(`/media/${id}`);
    return data;
  },
};

export default api;
