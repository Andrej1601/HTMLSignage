import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ScheduleSchema } from '../../types/schedule.types.js';
import {
  attachDeviceSnapshotMetaList,
} from '../../lib/deviceSnapshots.js';
import {
  findMissingEntityIds,
} from '../../lib/deviceManagement.js';

export const DEFAULT_DEVICE_LIMIT = 250;
export const MAX_DEVICE_LIMIT = 1000;

export const DEVICE_ADMIN_INCLUDE = {
  user: {
    select: { username: true },
  },
  overrides: true,
} satisfies Prisma.DeviceInclude;

export async function loadAdminDevicesByIds(deviceIds: string[]) {
  return prisma.device.findMany({
    where: { id: { in: deviceIds } },
    include: DEVICE_ADMIN_INCLUDE,
  });
}

export const DeviceIdListSchema = z.array(z.string().min(1)).min(1).max(100).transform((ids) => (
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
));

export const CreateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  groupName: z.string().trim().max(80).nullable().optional(),
  mode: z.enum(['auto', 'override']).optional().default('auto'),
  maintenanceMode: z.boolean().optional().default(false),
});

export const UpdateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  groupName: z.string().trim().max(80).nullable().optional(),
  mode: z.enum(['auto', 'override']).optional(),
  maintenanceMode: z.boolean().optional(),
});

export const ControlCommandSchema = z.object({
  action: z.enum(['reload', 'restart', 'clear-cache']),
});

export const DeviceSnapshotSchema = z.object({
  imageDataUrl: z.string().min(100).max(6_000_000),
});

export const OverridesSchema = z.object({
  schedule: ScheduleSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => Boolean(data.schedule) || Boolean(data.settings), {
  message: 'At least one override (schedule or settings) is required',
});

export { attachDeviceSnapshotMetaList, findMissingEntityIds };
