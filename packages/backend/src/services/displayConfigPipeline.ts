/**
 * Pure pipeline stages for the device display-config service.
 *
 * No DB / IO / framework imports — keeps these functions trivially
 * testable from a vanilla Node test runner without a DATABASE_URL.
 *
 * The async orchestrator lives in `displayConfig.ts` and composes
 * these via `assembleDisplayConfig`.
 */

import type { Schedule } from '@htmlsignage/shared/schedule';
import type { DeviceMode } from '../lib/deviceManagement.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DisplayConfigPayload {
  deviceId: string;
  maintenanceMode: boolean;
  mode: DeviceMode;
  hasScheduleOverride: boolean;
  schedule: Schedule;
  settings: Record<string, unknown>;
}

export interface DisplayConfigInputs {
  deviceId: string;
  mode: DeviceMode;
  maintenanceMode: boolean;
  globalSchedule: Schedule;
  globalSettings: Record<string, unknown>;
  deviceSlideshowConfig: unknown | null;
  defaultSlideshowConfig: unknown | null;
  eventSlideshowMap: Map<string, unknown>;
  overrideSchedule: Schedule | null;
}

// ─── Pure Pipeline Stages ───────────────────────────────────────────────────

/**
 * Picks the effective slideshow config: device-specific > default-from-DB.
 * Returns a new object — does not mutate the input.
 */
export function applySlideshowConfig(
  globalSettings: Record<string, unknown>,
  deviceSlideshowConfig: unknown | null,
  defaultSlideshowConfig: unknown | null,
): Record<string, unknown> {
  const effective = { ...globalSettings };
  if (deviceSlideshowConfig !== null && deviceSlideshowConfig !== undefined) {
    effective.slideshow = deviceSlideshowConfig;
  } else if (defaultSlideshowConfig !== null && defaultSlideshowConfig !== undefined) {
    effective.slideshow = defaultSlideshowConfig;
  }
  return effective;
}

/**
 * For each event with a `slideshowId` referenced in `eventSlideshowMap`,
 * embed the slideshow config into `event.settingsOverrides.slideshow` so
 * the display can render the event slideshow when the event is active.
 */
export function applyEventSlideshows(
  effectiveSettings: Record<string, unknown>,
  eventSlideshowMap: Map<string, unknown>,
): Record<string, unknown> {
  const events = effectiveSettings.events;
  if (!Array.isArray(events) || eventSlideshowMap.size === 0) {
    return effectiveSettings;
  }

  return {
    ...effectiveSettings,
    events: events.map((event) => {
      if (!isObject(event)) return event;
      const sid = typeof event.slideshowId === 'string' ? event.slideshowId : null;
      if (!sid || !eventSlideshowMap.has(sid)) return event;
      return {
        ...event,
        settingsOverrides: { slideshow: eventSlideshowMap.get(sid) },
      };
    }),
  };
}

/**
 * Picks the effective schedule. When `mode === 'override'` and the device
 * has a parsed override-schedule, use it; otherwise the global schedule.
 */
export function resolveEffectiveSchedule(
  mode: DeviceMode,
  globalSchedule: Schedule,
  overrideSchedule: Schedule | null,
): { schedule: Schedule; hasScheduleOverride: boolean } {
  const hasScheduleOverride = overrideSchedule !== null;
  const schedule =
    mode === 'override' && hasScheduleOverride ? overrideSchedule : globalSchedule;
  return { schedule, hasScheduleOverride };
}

/**
 * Top-level pure assembly: composes all pipeline stages into the final
 * payload. Independently testable without DB.
 */
export function assembleDisplayConfig(inputs: DisplayConfigInputs): DisplayConfigPayload {
  const withSlideshow = applySlideshowConfig(
    inputs.globalSettings,
    inputs.deviceSlideshowConfig,
    inputs.defaultSlideshowConfig,
  );
  const withEvents = applyEventSlideshows(withSlideshow, inputs.eventSlideshowMap);
  const { schedule, hasScheduleOverride } = resolveEffectiveSchedule(
    inputs.mode,
    inputs.globalSchedule,
    inputs.overrideSchedule,
  );

  return {
    deviceId: inputs.deviceId,
    maintenanceMode: inputs.maintenanceMode,
    mode: inputs.mode,
    hasScheduleOverride,
    schedule,
    settings: withEvents,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function collectEventSlideshowIds(settings: Record<string, unknown>): string[] {
  const events = settings.events;
  if (!Array.isArray(events)) return [];
  const ids: string[] = [];
  for (const event of events) {
    if (isObject(event) && typeof event.slideshowId === 'string' && event.slideshowId.length > 0) {
      ids.push(event.slideshowId);
    }
  }
  return ids;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
