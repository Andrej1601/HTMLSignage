import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { isPlainRecord } from './utils.js';
import { DEFAULT_HEADER } from './schedule.js';

export interface DeviceFleetState {
  groupName: string | null;
  maintenanceMode: boolean;
}

export type DeviceMode = 'auto' | 'override';

type DeviceFleetWritableFields = {
  groupName?: string | null;
  mode?: DeviceMode;
  maintenanceMode?: boolean;
  slideshowId?: string | null;
};

export function normalizeSettingsData(raw: unknown): Record<string, unknown> {
  const data = isPlainRecord(raw) ? { ...raw } : {};
  if (!isPlainRecord(data.header)) {
    data.header = { ...DEFAULT_HEADER };
  }
  return data;
}

export function normalizeDeviceGroupName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readDeviceFleetState(device: unknown): DeviceFleetState {
  if (!isPlainRecord(device)) {
    return { groupName: null, maintenanceMode: false };
  }

  return {
    groupName: normalizeDeviceGroupName(typeof device.groupName === 'string' ? device.groupName : null),
    maintenanceMode: device.maintenanceMode === true,
  };
}

export function decodeSnapshotDataUrl(imageDataUrl: string): Buffer | null {
  const match = imageDataUrl.match(/^data:image\/jpeg;base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match || !match[1]) return null;
  return Buffer.from(match[1], 'base64');
}

export function findMissingEntityIds<T extends { id: string }>(requestedIds: string[], foundEntities: T[]): string[] {
  const foundIds = new Set(foundEntities.map((entity) => entity.id));
  return requestedIds.filter((id) => !foundIds.has(id));
}

export function buildDeviceCreateData(input: {
  name: string;
  groupName?: string | null;
  maintenanceMode: boolean;
  mode: DeviceMode;
  pairedAt?: Date;
}): Prisma.DeviceCreateInput {
  return {
    name: input.name,
    groupName: normalizeDeviceGroupName(input.groupName),
    maintenanceMode: input.maintenanceMode,
    mode: input.mode,
    pairedAt: input.pairedAt ?? new Date(),
  };
}

export function buildDeviceUpdateData(input: {
  name?: string;
} & DeviceFleetWritableFields): Prisma.DeviceUpdateInput {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.mode !== undefined) updates.mode = input.mode;
  if (input.groupName !== undefined) updates.groupName = normalizeDeviceGroupName(input.groupName);
  if (input.maintenanceMode !== undefined) updates.maintenanceMode = input.maintenanceMode;
  if (input.slideshowId !== undefined) {
    updates.slideshow = input.slideshowId
      ? { connect: { id: input.slideshowId } }
      : { disconnect: true };
  }

  return updates as Prisma.DeviceUpdateInput;
}

export function buildBulkDeviceUpdateData(input: DeviceFleetWritableFields): Prisma.DeviceUpdateManyMutationInput {
  const updates: Record<string, unknown> = {};

  if (input.mode !== undefined) updates.mode = input.mode;
  if (input.maintenanceMode !== undefined) updates.maintenanceMode = input.maintenanceMode;
  if (input.groupName !== undefined) updates.groupName = normalizeDeviceGroupName(input.groupName);

  return updates as Prisma.DeviceUpdateManyMutationInput;
}

export function buildDeviceUpdateAuditDetails(input: {
  name?: string;
} & DeviceFleetWritableFields): Prisma.InputJsonObject {
  const details: Record<string, Prisma.InputJsonValue | null> = {};

  if (input.name !== undefined) details.name = input.name;
  if (input.mode !== undefined) details.mode = input.mode;
  if (input.maintenanceMode !== undefined) details.maintenanceMode = input.maintenanceMode;
  if (input.groupName !== undefined) details.groupName = normalizeDeviceGroupName(input.groupName);
  if (input.slideshowId !== undefined) details.slideshowId = input.slideshowId;

  return details as Prisma.InputJsonObject;
}

export function buildDeviceCreateAuditDetails(input: {
  name: string;
  groupName?: string | null;
  maintenanceMode: boolean;
  mode: DeviceMode | string;
}): Prisma.InputJsonObject {
  return {
    groupName: normalizeDeviceGroupName(input.groupName),
    maintenanceMode: input.maintenanceMode,
    mode: input.mode,
    name: input.name,
  };
}

export function buildBulkDeviceUpdateAuditDetails(input: {
  deviceIds: string[];
  updates: DeviceFleetWritableFields;
}): Prisma.InputJsonObject {
  return {
    affectedCount: input.deviceIds.length,
    deviceIds: input.deviceIds,
    updates: buildDeviceUpdateAuditDetails(input.updates),
  };
}

export function buildBulkDeviceCommandAuditDetails(input: {
  deviceIds: string[];
  command: 'reload' | 'restart' | 'clear-cache';
}): Prisma.InputJsonObject {
  return {
    affectedCount: input.deviceIds.length,
    deviceIds: input.deviceIds,
    command: input.command,
  };
}

export function buildDevicePairAuditDetails(input: {
  name: string;
  groupName?: string | null;
}): Prisma.InputJsonObject {
  return {
    groupName: normalizeDeviceGroupName(input.groupName),
    name: input.name,
  };
}

// `buildDeviceDisplayConfigPayload` was moved to `services/displayConfig.ts`
// as `assembleDisplayConfig` plus pure pipeline stages. The route handler
// now calls `resolveDeviceDisplayConfig(deviceId)` directly.

function hashBrowserIdToPairingCode(value: string): string {
  return parseInt(
    createHash('sha256').update(value).digest('hex').substring(0, 8),
    16,
  ).toString().substring(0, 6).padStart(6, '0');
}

export async function generateUniquePairingCode(
  browserId: string,
  isCodeTaken: (pairingCode: string) => Promise<boolean>,
): Promise<string> {
  let pairingCode = hashBrowserIdToPairingCode(browserId);
  let attempt = 0;

  while (await isCodeTaken(pairingCode) && attempt < 10) {
    pairingCode = hashBrowserIdToPairingCode(browserId + attempt);
    attempt += 1;
  }

  return pairingCode;
}
