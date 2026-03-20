import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ScheduleSchema } from '../types/schedule.types.js';
import { broadcastDeviceCommand, broadcastDeviceUpdate } from '../websocket/index.js';
import { authMiddleware, deviceAuthMiddleware, generateDeviceToken, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { mutationLimiter, pairingRequestLimiter, heartbeatLimiter } from '../lib/rateLimiter.js';
import { logAuditEvent } from '../lib/audit.js';
import { normalizeScheduleData } from '../lib/schedule.js';
import {
  attachDeviceSnapshotMeta,
  attachDeviceSnapshotMetaList,
  deleteDeviceSnapshot,
  saveDeviceSnapshot,
} from '../lib/deviceSnapshots.js';
import {
  buildBulkDeviceCommandAuditDetails,
  buildBulkDeviceUpdateAuditDetails,
  buildBulkDeviceUpdateData,
  buildDeviceCreateAuditDetails,
  buildDeviceCreateData,
  buildDeviceDisplayConfigPayload,
  buildDevicePairAuditDetails,
  buildDeviceUpdateAuditDetails,
  buildDeviceUpdateData,
  decodeSnapshotDataUrl,
  findMissingEntityIds,
  generateUniquePairingCode,
  normalizeDeviceGroupName,
  normalizeSettingsData,
  readDeviceFleetState,
} from '../lib/deviceManagement.js';

const router = Router();
const DEFAULT_DEVICE_LIMIT = 250;
const MAX_DEVICE_LIMIT = 1000;
const DEVICE_ADMIN_INCLUDE = {
  user: {
    select: { username: true },
  },
  overrides: true,
} satisfies Prisma.DeviceInclude;

async function loadAdminDevicesByIds(deviceIds: string[]) {
  return prisma.device.findMany({
    where: { id: { in: deviceIds } },
    include: DEVICE_ADMIN_INCLUDE,
  });
}

const DeviceIdListSchema = z.array(z.string().min(1)).min(1).max(100).transform((ids) => (
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)))
));

const CreateDeviceSchema = z.object({
  name: z.string().trim().min(1),
  groupName: z.string().trim().max(80).nullable().optional(),
  mode: z.enum(['auto', 'override']).optional().default('auto'),
  maintenanceMode: z.boolean().optional().default(false),
});

const UpdateDeviceSchema = z.object({
  name: z.string().trim().min(1).optional(),
  groupName: z.string().trim().max(80).nullable().optional(),
  mode: z.enum(['auto', 'override']).optional(),
  maintenanceMode: z.boolean().optional(),
});

const ControlCommandSchema = z.object({
  action: z.enum(['reload', 'restart', 'clear-cache']),
});

const BulkUpdateDeviceSchema = z.object({
  deviceIds: DeviceIdListSchema,
  updates: z.object({
    groupName: z.string().trim().max(80).nullable().optional(),
    mode: z.enum(['auto', 'override']).optional(),
    maintenanceMode: z.boolean().optional(),
  }).superRefine((value, ctx) => {
    if (
      value.groupName === undefined &&
      value.mode === undefined &&
      value.maintenanceMode === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one update field is required',
      });
    }
  }),
});

const BulkControlCommandSchema = z.object({
  deviceIds: DeviceIdListSchema,
  command: ControlCommandSchema,
});

const OverridesSchema = z.object({
  schedule: ScheduleSchema.optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
}).refine((data) => Boolean(data.schedule) || Boolean(data.settings), {
  message: 'At least one override (schedule or settings) is required',
});

const RequestPairingSchema = z.object({
  browserId: z.string().min(20).max(128),
});

const DeviceSnapshotSchema = z.object({
  imageDataUrl: z.string().min(100).max(6_000_000),
});

// GET /api/devices - List all devices (admin only)
router.get('/', authMiddleware, requirePermission('devices:manage'), async (_req: AuthRequest, res) => {
  try {
    const parsedLimit = Number.parseInt(String(_req.query.limit ?? ''), 10);
    const parsedOffset = Number.parseInt(String(_req.query.offset ?? ''), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_DEVICE_LIMIT)
      : DEFAULT_DEVICE_LIMIT;
    const offset = Number.isFinite(parsedOffset)
      ? Math.min(Math.max(parsedOffset, 0), 10_000)
      : 0;

    const [devices, totalCount] = await Promise.all([
      prisma.device.findMany({
        include: DEVICE_ADMIN_INCLUDE,
        orderBy: { lastSeen: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.device.count(),
    ]);

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Result-Limit', String(limit));
    res.setHeader('X-Result-Offset', String(offset));
    const devicesWithSnapshots = await attachDeviceSnapshotMetaList(devices);
    res.json(devicesWithSnapshots);
  } catch (error) {
    console.error('[devices] Error listing:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
  }
});

// GET /api/devices/pending - Get all devices pending pairing (admin only)
// IMPORTANT: Must be before /:id route to avoid "pending" being interpreted as an ID
router.get('/pending', authMiddleware, requirePermission('devices:manage'), async (req: AuthRequest, res) => {
  try {
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_DEVICE_LIMIT)
      : DEFAULT_DEVICE_LIMIT;

    const devices = await prisma.device.findMany({
      where: {
        pairedAt: null,
        pairingCode: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.setHeader('X-Result-Limit', String(limit));
    res.json(devices);
  } catch (error) {
    console.error('[devices] Error fetching pending devices:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
  }
});

// GET /api/devices/:id/display-config - Effective schedule/settings for a specific device (device token)
router.get('/:id/display-config', deviceAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: {
        overrides: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'not-found', message: 'Device not found' });
    }

    const [activeSchedule, activeSettings] = await Promise.all([
      prisma.schedule.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      }),
      prisma.settings.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
      }),
    ]);

    const globalSchedule = normalizeScheduleData(activeSchedule?.data);
    const globalSettings = normalizeSettingsData(activeSettings?.data);

    const scheduleOverride = ScheduleSchema.safeParse(device.overrides?.schedule);
    const overrideSchedule = scheduleOverride.success ? scheduleOverride.data : null;
    const fleetState = readDeviceFleetState(device);

    return res.json(buildDeviceDisplayConfigPayload({
      deviceId: device.id,
      maintenanceMode: fleetState.maintenanceMode,
      mode: device.mode as 'auto' | 'override',
      globalSchedule,
      globalSettings,
      overrideSchedule,
      overrideSettings: device.overrides?.settings,
    }));
  } catch (error) {
    console.error('[devices] Error fetching display config:', error);
    return res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
  }
});

// GET /api/devices/:id - Get device details (admin only)
router.get('/:id', authMiddleware, requirePermission('devices:manage'), async (req: AuthRequest, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (!device) {
      return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
    }

    const deviceWithSnapshot = await attachDeviceSnapshotMeta(device);
    res.json(deviceWithSnapshot);
  } catch (error) {
    console.error('[devices] Error fetching device:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
  }
});

// POST /api/devices/:id/snapshot - Upload live device snapshot
router.post('/:id/snapshot', deviceAuthMiddleware, heartbeatLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = DeviceSnapshotSchema.parse(req.body);
    const buffer = decodeSnapshotDataUrl(validated.imageDataUrl);
    if (!buffer) {
      return res.status(400).json({ error: 'invalid-snapshot', message: 'Snapshot muss als JPEG Data-URL gesendet werden' });
    }

    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'snapshot-too-large', message: 'Snapshot ist zu groß' });
    }

    const meta = await saveDeviceSnapshot(req.params.id, buffer);
    return res.json({ ok: true, ...meta });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error saving snapshot:', error);
    return res.status(500).json({ error: 'snapshot-save-failed', message: 'Snapshot konnte nicht gespeichert werden' });
  }
});

// POST /api/devices - Create new device (auth required)
router.post('/', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = CreateDeviceSchema.parse(req.body);
    const device = await prisma.device.create({
      data: buildDeviceCreateData({
        name: validated.name,
        groupName: validated.groupName,
        maintenanceMode: validated.maintenanceMode,
        mode: validated.mode,
      }),
      include: DEVICE_ADMIN_INCLUDE,
    });
    const fleetState = readDeviceFleetState(device);

    broadcastDeviceUpdate(device);
    await logAuditEvent(req, {
      action: 'device.create',
      resource: device.id,
      details: buildDeviceCreateAuditDetails({
        groupName: fleetState.groupName,
        maintenanceMode: fleetState.maintenanceMode,
        mode: device.mode,
        name: device.name,
      }),
    });

    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error creating device:', error);
    res.status(500).json({ error: 'create-failed', message: 'Gerät konnte nicht erstellt werden' });
  }
});

// PATCH /api/devices/:id - Update device (auth required)
router.patch('/:id', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = UpdateDeviceSchema.parse(req.body);
    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: buildDeviceUpdateData(validated),
      include: DEVICE_ADMIN_INCLUDE,
    });

    broadcastDeviceUpdate(device);
    await logAuditEvent(req, {
      action: 'device.update',
      resource: device.id,
      details: buildDeviceUpdateAuditDetails(validated),
    });

    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error updating device:', error);
    res.status(500).json({ error: 'update-failed', message: 'Gerät konnte nicht aktualisiert werden' });
  }
});

// DELETE /api/devices/:id - Delete device (auth required)
router.delete('/:id', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.device.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, mode: true },
    });

    await prisma.device.delete({
      where: { id: req.params.id },
    });
    await deleteDeviceSnapshot(req.params.id);

    broadcastDeviceUpdate({ id: req.params.id, deleted: true });
    await logAuditEvent(req, {
      action: 'device.delete',
      resource: req.params.id,
      details: existing,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Error deleting device:', error);
    res.status(500).json({ error: 'delete-failed', message: 'Gerät konnte nicht gelöscht werden' });
  }
});

// PATCH /api/devices/bulk/update - Bulk update device fleet properties (auth required)
router.patch('/bulk/update', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = BulkUpdateDeviceSchema.parse(req.body);
    const devices = await loadAdminDevicesByIds(validated.deviceIds);
    const missingIds = findMissingEntityIds(validated.deviceIds, devices);

    if (missingIds.length > 0) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Ein oder mehrere Geräte wurden nicht gefunden',
        missingIds,
      });
    }

    await prisma.device.updateMany({
      where: { id: { in: validated.deviceIds } },
      data: buildBulkDeviceUpdateData(validated.updates),
    });

    const updatedDevices = await loadAdminDevicesByIds(validated.deviceIds);
    updatedDevices.forEach((device) => broadcastDeviceUpdate(device));

    await logAuditEvent(req, {
      action: 'device.bulk.update',
      resource: null,
      details: buildBulkDeviceUpdateAuditDetails({
        deviceIds: updatedDevices.map((device) => device.id),
        updates: validated.updates,
      }),
    });

    return res.json({
      ok: true,
      affectedCount: updatedDevices.length,
      deviceIds: updatedDevices.map((device) => device.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error bulk updating devices:', error);
    return res.status(500).json({ error: 'bulk-update-failed', message: 'Geräte konnten nicht gesammelt aktualisiert werden' });
  }
});

// POST /api/devices/:id/heartbeat - Device heartbeat
router.post('/:id/heartbeat', deviceAuthMiddleware, heartbeatLimiter, async (req: AuthRequest, res) => {
  try {
    await prisma.device.update({
      where: { id: req.params.id },
      data: { lastSeen: new Date() },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Heartbeat error:', error);
    res.status(500).json({ error: 'update-failed', message: 'Gerät konnte nicht aktualisiert werden' });
  }
});

// POST /api/devices/bulk/control - Send one command to multiple devices
router.post('/bulk/control', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = BulkControlCommandSchema.parse(req.body);
    const devices = await prisma.device.findMany({
      where: { id: { in: validated.deviceIds } },
      select: { id: true, name: true },
    });
    const missingIds = findMissingEntityIds(validated.deviceIds, devices);

    if (missingIds.length > 0) {
      return res.status(404).json({
        error: 'not-found',
        message: 'Ein oder mehrere Geräte wurden nicht gefunden',
        missingIds,
      });
    }

    devices.forEach((device) => {
      broadcastDeviceCommand(device.id, {
        command: validated.command.action,
      });
    });

    await logAuditEvent(req, {
      action: 'device.bulk.command',
      resource: null,
      details: buildBulkDeviceCommandAuditDetails({
        deviceIds: devices.map((device) => device.id),
        command: validated.command.action,
      }),
    });

    return res.json({
      ok: true,
      affectedCount: devices.length,
      deviceIds: devices.map((device) => device.id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error sending bulk control command:', error);
    return res.status(500).json({ error: 'bulk-command-failed', message: 'Befehle konnten nicht an die Geräte gesendet werden' });
  }
});

// POST /api/devices/:id/control - Send control command (auth required)
router.post('/:id/control', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = ControlCommandSchema.parse(req.body);

    // Broadcast control command to the targeted device.
    broadcastDeviceCommand(req.params.id, {
      command: validated.action,
    });
    await logAuditEvent(req, {
      action: 'device.command',
      resource: req.params.id,
      details: {
        command: validated.action,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error sending control command:', error);
    res.status(500).json({ error: 'command-failed', message: 'Befehl konnte nicht ausgeführt werden' });
  }
});

// POST /api/devices/:id/overrides - Set device overrides (auth required)
router.post('/:id/overrides', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = OverridesSchema.parse(req.body);

    await prisma.deviceOverride.upsert({
      where: { deviceId: req.params.id },
      create: {
        deviceId: req.params.id,
        schedule: (validated.schedule || {}) as unknown as Prisma.InputJsonValue,
        settings: (validated.settings || {}) as unknown as Prisma.InputJsonValue,
      },
      update: {
        schedule: validated.schedule as unknown as Prisma.InputJsonValue,
        settings: validated.settings as unknown as Prisma.InputJsonValue,
      },
    });

    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (device) {
      broadcastDeviceUpdate(device);
    } else {
      broadcastDeviceUpdate({ id: req.params.id, overridesUpdated: true });
    }
    await logAuditEvent(req, {
      action: 'device.override.update',
      resource: req.params.id,
      details: {
        hasSchedule: Boolean(validated.schedule),
        hasSettings: Boolean(validated.settings),
      },
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error setting overrides:', error);
    res.status(500).json({ error: 'overrides-failed', message: 'Überschreibungen konnten nicht gespeichert werden' });
  }
});

// DELETE /api/devices/:id/overrides - Clear device overrides (auth required)
router.delete('/:id/overrides', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    await prisma.deviceOverride.deleteMany({
      where: { deviceId: req.params.id },
    });

    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (device) {
      broadcastDeviceUpdate(device);
    } else {
      broadcastDeviceUpdate({ id: req.params.id, overridesCleared: true });
    }
    await logAuditEvent(req, {
      action: 'device.override.clear',
      resource: req.params.id,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Error clearing overrides:', error);
    res.status(500).json({ error: 'clear-overrides-failed', message: 'Überschreibungen konnten nicht gelöscht werden' });
  }
});

// ============================================================================
// Device Pairing
// ============================================================================

const PairDeviceSchema = z.object({
  pairingCode: z.string().length(6),
  name: z.string().trim().min(1).optional(),
  groupName: z.string().trim().max(80).nullable().optional(),
});

// POST /api/devices/request-pairing - Request a pairing code (called by unpaired device)
router.post('/request-pairing', pairingRequestLimiter, async (req, res) => {
  try {
    const validated = RequestPairingSchema.parse(req.body);
    const { browserId } = validated;
    const deviceToken = generateDeviceToken(browserId);

    // Check if device with this browser ID already exists
    let device = await prisma.device.findUnique({ where: { id: browserId } });

    if (device) {
      // Device exists - return current status
      return res.json({
        id: device.id,
        pairingCode: device.pairingCode,
        paired: !!device.pairedAt,
        name: device.name,
        deviceToken,
      });
    }

    const pairingCode = await generateUniquePairingCode(
      browserId,
      async (candidate) => Boolean(await prisma.device.findUnique({ where: { pairingCode: candidate } })),
    );

    // Create new device with browser ID as primary key
    device = await prisma.device.create({
      data: {
        id: browserId,
        name: 'Nicht verbundenes Gerät',
        pairingCode,
      },
    });

    broadcastDeviceUpdate({ ...device, pendingPairing: true });

    res.json({
      id: device.id,
      pairingCode,
      paired: false,
      deviceToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error requesting pairing:', error);
    res.status(500).json({ error: 'pairing-request-failed', message: 'Kopplungsanfrage fehlgeschlagen' });
  }
});

// POST /api/devices/pair - Pair a device using pairing code (called by admin)
router.post('/pair', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = PairDeviceSchema.parse(req.body);

    const device = await prisma.device.findUnique({
      where: { pairingCode: validated.pairingCode },
    });

    if (!device) {
      return res.status(404).json({ error: 'invalid-code', message: 'Invalid pairing code' });
    }

    if (device.pairedAt) {
      return res.status(400).json({ error: 'already-paired', message: 'Device is already paired' });
    }

    // Pair the device
    const pairedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        name: validated.name || device.name,
        groupName: normalizeDeviceGroupName(validated.groupName),
        pairedBy: req.userId,
        pairedAt: new Date(),
        pairingCode: null, // Clear pairing code after successful pairing
      } as Prisma.DeviceUpdateInput,
      include: DEVICE_ADMIN_INCLUDE,
    });
    const pairedFleetState = readDeviceFleetState(pairedDevice);

    broadcastDeviceUpdate({ ...pairedDevice, paired: true });
    await logAuditEvent(req, {
      action: 'device.pair',
      resource: pairedDevice.id,
      details: buildDevicePairAuditDetails({
        groupName: pairedFleetState.groupName,
        name: pairedDevice.name,
      }),
    });

    res.json(pairedDevice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error pairing device:', error);
    res.status(500).json({ error: 'pairing-failed', message: 'Kopplung fehlgeschlagen' });
  }
});

export default router;
