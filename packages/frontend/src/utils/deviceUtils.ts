import { isPlainRecord } from './objectUtils';
import type { Device } from '@/types/device.types';

/**
 * Returns true if the device has a stored schedule override.
 * Device-specific *settings* overrides are no longer supported — devices
 * pick up design/theme exclusively via their assigned slideshow.
 */
export function hasDeviceOverrides(device: Device): boolean {
  return Boolean(
    device.overrides?.schedule &&
      isPlainRecord(device.overrides.schedule) &&
      'presets' in device.overrides.schedule,
  );
}
