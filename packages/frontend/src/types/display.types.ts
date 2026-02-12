import type { Schedule } from './schedule.types';
import type { Settings } from './settings.types';

export type SlideType = 'overview' | 'detail' | 'clock';

export interface DisplayConfig {
  deviceId: string;
  schedule: Schedule;
  settings: Settings;
  currentSlide: SlideType;
  slideIndex: number;
}

export interface SlideConfig {
  type: SlideType;
  duration: number; // seconds
  data?: unknown;
}

export interface DisplayState {
  isConnected: boolean;
  lastUpdate: Date | null;
  currentSlide: SlideType;
  slideIndex: number;
  error: string | null;
}

// WebSocket message types
export interface WSScheduleUpdate {
  type: 'schedule:updated';
  data: Schedule;
}

export interface WSSettingsUpdate {
  type: 'settings:updated';
  data: Settings;
}

export interface WSDeviceCommand {
  type: 'device:command';
  command: 'reload' | 'restart' | 'clear-cache';
}

export type WSMessage = WSScheduleUpdate | WSSettingsUpdate | WSDeviceCommand;
