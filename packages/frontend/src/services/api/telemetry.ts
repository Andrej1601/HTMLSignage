import { api, getDeviceHeaders } from './core';

export interface DesignErrorReport {
  designId: string;
  slideType: string;
  message: string;
  stack?: string;
  componentStack?: string;
  occurredAt?: string;
}

/**
 * Best-effort POST of a design renderer crash to the backend audit log.
 *
 * Failures are swallowed: the display has already fallen back to a
 * placeholder slide via the boundary, so a missing telemetry round-trip
 * must never escalate to a second user-visible error. Both admin users
 * (cookie auth) and paired display devices (X-Device-Token) can post.
 */
export async function recordDesignError(
  report: DesignErrorReport,
  options: { deviceToken?: string } = {},
): Promise<void> {
  try {
    await api.post('/telemetry/display/error', report, {
      headers: getDeviceHeaders(options.deviceToken),
      // Telemetry is best-effort — don't let it block long-running work.
      timeout: 4000,
    });
  } catch {
    // Intentionally silent.
  }
}
