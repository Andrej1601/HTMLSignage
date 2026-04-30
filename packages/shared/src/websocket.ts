/**
 * WebSocket event contract between frontend and backend.
 *
 * Both packages import these interfaces and pass them as Socket.IO type
 * parameters. Schema changes break consumers at compile time, eliminating
 * the previous "broadcast `data: unknown`, cast to `Settings` on receive"
 * runtime drift.
 */

import type { Schedule } from './schedule.js';
import type { SettingsShared } from './settings.js';

/** Payload broadcast for individual device updates. Loose by design — the
 * device record on the server combines admin-only fields and device-token
 * fields and we don't want to leak admin-only fields into device sockets.
 * Concrete typing happens at use-sites. */
export type DeviceUpdatePayload = Record<string, unknown>;

/** Payload broadcast for bulk device updates (admin room only). */
export type BulkDeviceUpdatePayload = Record<string, unknown>[];

/** Command sent to a specific device socket. */
export interface DeviceCommandPayload {
  command?: string;
  [key: string]: unknown;
}

/** Returned to a subscriber when authentication for a channel fails. */
export interface SubscribeErrorPayload {
  error: string;
  channel: string;
}

/** Returned to a device socket when device authentication fails. */
export interface DeviceAuthErrorPayload {
  error: string;
}

// ─── Server → Client ────────────────────────────────────────────────────────

export interface ServerToClientEvents {
  'schedule:updated': (data: Schedule) => void;
  'settings:updated': (data: SettingsShared) => void;
  'device:updated': (data: DeviceUpdatePayload) => void;
  'device:command': (data: DeviceCommandPayload) => void;
  'devices:bulk-updated': (devices: BulkDeviceUpdatePayload) => void;
  'subscribe:error': (payload: SubscribeErrorPayload) => void;
  'device:auth-error': (payload: DeviceAuthErrorPayload) => void;
}

// ─── Client → Server ────────────────────────────────────────────────────────

export type SubscribeAuthPayload = string | { token?: string };

export interface SubscribeDevicePayload {
  deviceId?: string;
  deviceToken?: string;
}

export interface ClientToServerEvents {
  'subscribe:schedule': (payload?: SubscribeAuthPayload) => void;
  'subscribe:settings': (payload?: SubscribeAuthPayload) => void;
  'subscribe:device': (payload: string | SubscribeDevicePayload) => void;
  'unsubscribe:schedule': () => void;
  'unsubscribe:settings': () => void;
  'unsubscribe:device': (deviceId: string) => void;
}

// ─── Inter-Server Events (unused for now) ───────────────────────────────────

export interface InterServerEvents {
  // Reserved for future horizontal-scaling adapters.
  ping?: () => void;
}

// ─── Per-Socket Data ────────────────────────────────────────────────────────

/** Per-socket attached data. The handshake middleware sets `userId` when
 * the auth_token cookie verifies. */
export interface SocketData {
  userId?: string;
}
