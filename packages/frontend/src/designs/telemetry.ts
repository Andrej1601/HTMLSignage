import type { ErrorInfo } from 'react';
import type { SlideTypeId } from '@htmlsignage/design-sdk';

/**
 * Lightweight telemetry client for the design-pack pipeline.
 *
 * Keeps no state beyond a best-effort short-term dedupe so a tight
 * render-loop crash doesn't spam the endpoint. Uses `fetch` with
 * `keepalive` so pending posts survive the display's automatic reload
 * / tab unload. Intentionally no dependencies — the client should
 * remain compact and ship in the display bundle without drag.
 */

interface DesignErrorReport {
  designId: string;
  slideType: SlideTypeId;
  message: string;
  stack?: string;
  componentStack?: string;
  /** URL hash / pathname correlate to device/zone at report time. */
  url?: string;
  /** Device identifier, forwarded from the slide render context. */
  deviceId?: string;
  /** Best-effort user agent so cross-browser-specific issues surface. */
  userAgent?: string;
}

const recentlyReported = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000; // 1 min

function shouldReport(key: string): boolean {
  const now = Date.now();
  const last = recentlyReported.get(key);
  // Prune old entries opportunistically.
  for (const [k, ts] of recentlyReported) {
    if (now - ts > DEDUPE_WINDOW_MS) recentlyReported.delete(k);
  }
  if (last && now - last < DEDUPE_WINDOW_MS) return false;
  recentlyReported.set(key, now);
  return true;
}

/**
 * POST a design renderer crash to the telemetry endpoint. Network
 * failures are swallowed silently — telemetry must never cause a
 * second-order failure on the display.
 */
export function reportDesignError(input: {
  designId: string;
  slideType: SlideTypeId;
  error: Error;
  info?: ErrorInfo;
  deviceId?: string;
}): void {
  try {
    const { designId, slideType, error, info, deviceId } = input;

    // Dedupe on the "primary key" of a crash so repeated rerenders
    // of the same failure don't flood the endpoint.
    const dedupeKey = [designId, slideType, error.name, error.message?.slice(0, 120)]
      .join('|');
    if (!shouldReport(dedupeKey)) return;

    const report: DesignErrorReport = {
      designId,
      slideType,
      message: error.message || 'Unknown design renderer error',
      stack: error.stack,
      componentStack: info?.componentStack || undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      deviceId,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Fire-and-forget. `keepalive` lets the post finish even if the
    // page unloads right after (common when the error triggers a reload).
    void fetch('/api/telemetry/display/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}
