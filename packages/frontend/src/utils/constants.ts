/**
 * Shared constants used across multiple pages/components.
 */

/** A paired device is considered "online" if its last heartbeat is within this many minutes. */
export const ONLINE_THRESHOLD_MINUTES = 5;

/** Default request timeout for API calls in milliseconds. */
export const API_REQUEST_TIMEOUT_MS = 8000;

/** WebSocket reconnection settings. */
export const WS_RECONNECT = {
  delayMs: 1000,
  delayMaxMs: 30000,
  attempts: Infinity,
  randomizationFactor: 0.5,
  timeoutMs: 10000,
} as const;

/** Dashboard polling intervals in milliseconds. */
export const DASHBOARD_POLLING = {
  backendHealthMs: 30000,
  runtimeStatusMs: 30000,
  runtimeHistoryMs: 5 * 60 * 1000,
  systemUpdateMs: 60000,
  auditLogMs: 15000,
  systemJobsMs: 5000,
} as const;

/** Auth retry interval in milliseconds. */
export const AUTH_RETRY_INTERVAL_MS = 30000;

/** Event clock update interval in milliseconds. */
export const EVENT_CLOCK_INTERVAL_MS = 30000;

/** Device heartbeat interval in milliseconds. */
export const DEVICE_HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

/** Media refresh interval in milliseconds. */
export const MEDIA_REFRESH_INTERVAL_MS = 300_000;

/** Device pairing check interval in milliseconds. */
export const PAIRING_CHECK_INTERVAL_MS = 30_000;

/** Slide error boundary auto-recovery time in milliseconds. */
export const SLIDE_AUTO_RECOVER_MS = 10000;

/** Toast auto-dismiss durations in milliseconds. */
export const TOAST_DURATION = {
  errorMs: 6000,
  defaultMs: 4000,
} as const;

/** Global React Query staleTime in milliseconds. */
export const QUERY_STALE_TIME_MS = 30000;
