/**
 * Display-Config Resolution Service — Async Orchestrator.
 *
 * Loads the data needed to resolve the effective schedule + settings for
 * a device and feeds it into the pure pipeline (`displayConfigPipeline.ts`).
 * Replaces the ad-hoc resolution code that lived in `routes/devices/index.ts`
 * so the logic is testable without HTTP and the override hierarchy is
 * documented in one place.
 *
 * Override hierarchy (top wins):
 *   1. Maintenance mode (rendered as flag, doesn't replace content)
 *   2. Event slideshow (embedded into events[].settingsOverrides)
 *   3. Device-specific slideshow assignment (`device.slideshowId`)
 *   4. Default slideshow from `slideshows` table (`isDefault: true`)
 *   5. Global settings + schedule from cache
 *   6. Device-mode `override` schedule replaces global schedule when set
 */

import { ScheduleSchema, normalizeScheduleData } from '@htmlsignage/shared/schedule';
import { prisma } from '../lib/prisma.js';
import { getCachedGlobalConfig } from '../lib/globalConfigCache.js';
import {
  normalizeSettingsData,
  readDeviceFleetState,
  type DeviceMode,
} from '../lib/deviceManagement.js';
import {
  assembleDisplayConfig,
  collectEventSlideshowIds,
  type DisplayConfigPayload,
} from './displayConfigPipeline.js';

export type { DisplayConfigPayload } from './displayConfigPipeline.js';
export {
  applySlideshowConfig,
  applyEventSlideshows,
  resolveEffectiveSchedule,
  assembleDisplayConfig,
} from './displayConfigPipeline.js';

/**
 * Resolves the effective display config for a paired device.
 * Returns `null` when the device id is not found.
 */
export async function resolveDeviceDisplayConfig(
  deviceId: string,
): Promise<DisplayConfigPayload | null> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { overrides: true, slideshow: true },
  });

  if (!device) return null;

  const { scheduleData, settingsData } = await getCachedGlobalConfig();
  const globalSchedule = normalizeScheduleData(scheduleData);
  const globalSettings = normalizeSettingsData(settingsData);

  // Default slideshow lookup is only needed when the device has no specific
  // slideshow assigned. Avoid the DB hit in the common case.
  const deviceSlideshowConfig = device.slideshow?.config ?? null;
  let defaultSlideshowConfig: unknown | null = null;
  if (deviceSlideshowConfig === null) {
    const defaultSlideshow = await prisma.slideshow.findFirst({
      where: { isDefault: true },
      select: { config: true },
    });
    defaultSlideshowConfig = defaultSlideshow?.config ?? null;
  }

  // Collect referenced event slideshows in one batched query.
  const eventSlideshowIds = collectEventSlideshowIds(globalSettings);
  const eventSlideshowMap = new Map<string, unknown>();
  if (eventSlideshowIds.length > 0) {
    const rows = await prisma.slideshow.findMany({
      where: { id: { in: eventSlideshowIds } },
      select: { id: true, config: true },
    });
    for (const row of rows) {
      eventSlideshowMap.set(row.id, row.config);
    }
  }

  const scheduleOverrideParse = ScheduleSchema.safeParse(device.overrides?.schedule);
  const overrideSchedule = scheduleOverrideParse.success ? scheduleOverrideParse.data : null;

  const fleetState = readDeviceFleetState(device);

  return assembleDisplayConfig({
    deviceId: device.id,
    mode: device.mode as DeviceMode,
    maintenanceMode: fleetState.maintenanceMode,
    globalSchedule,
    globalSettings,
    deviceSlideshowConfig,
    defaultSlideshowConfig,
    eventSlideshowMap,
    overrideSchedule,
  });
}
