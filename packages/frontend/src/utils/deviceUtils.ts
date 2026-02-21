import { isPlainRecord } from './objectUtils';
import type { Device } from '@/types/device.types';

/**
 * Returns true if the device has any stored overrides (schedule or settings).
 * Used in DashboardPage, SlideshowPage, and DeviceCard.
 */
export function hasDeviceOverrides(device: Device): boolean {
  const hasScheduleOverride = Boolean(
    device.overrides?.schedule &&
      isPlainRecord(device.overrides.schedule) &&
      'presets' in device.overrides.schedule,
  );
  const hasSettingsOverride = Boolean(
    device.overrides?.settings &&
      isPlainRecord(device.overrides.settings) &&
      Object.keys(device.overrides.settings).length > 0,
  );
  return hasScheduleOverride || hasSettingsOverride;
}

/**
 * Returns the device's settings override as a plain record.
 * Returns an empty object if no override exists.
 */
export function getDeviceOverrideSettings(device: Device | null): Record<string, unknown> {
  const settings = device?.overrides?.settings;
  return isPlainRecord(settings) ? { ...settings } : {};
}
