import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { broadcastDeviceCommand, broadcastDeviceUpdate } from '../../websocket/index.js';
import { authMiddleware, deviceAuthMiddleware, type AuthRequest, str } from '../../lib/auth.js';
import { requirePermission } from '../../lib/permissions.js';
import { mutationLimiter, heartbeatLimiter } from '../../lib/rateLimiter.js';
import { logAuditEvent } from '../../lib/audit.js';
import {
  attachDeviceSnapshotMeta,
} from '../../lib/deviceSnapshots.js';
import {
  buildDeviceCreateAuditDetails,
  buildDeviceCreateData,
  buildDeviceUpdateAuditDetails,
  buildDeviceUpdateData,
  decodeSnapshotDataUrl,
  readDeviceFleetState,
} from '../../lib/deviceManagement.js';
import { resolveDeviceDisplayConfig } from '../../services/displayConfig.js';
import {
  saveDeviceSnapshot,
  deleteDeviceSnapshot,
} from '../../lib/deviceSnapshots.js';
import {
  DEVICE_ADMIN_INCLUDE,
  DEFAULT_DEVICE_LIMIT,
  MAX_DEVICE_LIMIT,
  CreateDeviceSchema,
  UpdateDeviceSchema,
  ControlCommandSchema,
  DeviceSnapshotSchema,
  OverridesSchema,
  attachDeviceSnapshotMetaList,
} from './shared.js';
import pairingRouter from './pairing.js';
import bulkRouter from './bulk.js';

const router = Router();

// Mount sub-routers
router.use('/', pairingRouter);
router.use('/', bulkRouter);

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
    return;
  } catch (error) {
    console.error('[devices] Error listing:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
    return;
  }
});

// GET /api/devices/:id/display-config - Effective schedule/settings for a specific device (device token)
router.get('/:id/display-config', deviceAuthMiddleware, async (req: AuthRequest, res) => {
  try {
    const payload = await resolveDeviceDisplayConfig(str(req.params.id)!);
    if (!payload) {
      return res.status(404).json({ error: 'not-found', message: 'Device not found' });
    }
    return res.json(payload);
  } catch (error) {
    console.error('[devices] Error fetching display config:', error);
    return res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
    return;
  }
});

// GET /api/devices/:id - Get device details (admin only)
router.get('/:id', authMiddleware, requirePermission('devices:manage'), async (req: AuthRequest, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: str(req.params.id)! },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (!device) {
      return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
    }

    const deviceWithSnapshot = await attachDeviceSnapshotMeta(device);
    res.json(deviceWithSnapshot);
    return;
  } catch (error) {
    console.error('[devices] Error fetching device:', error);
    res.status(500).json({ error: 'fetch-failed', message: 'Geräte konnten nicht geladen werden' });
    return;
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

    const meta = await saveDeviceSnapshot(str(req.params.id)!, buffer);
    return res.json({ ok: true, ...meta });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error saving snapshot:', error);
    return res.status(500).json({ error: 'snapshot-save-failed', message: 'Snapshot konnte nicht gespeichert werden' });
    return;
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
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error creating device:', error);
    res.status(500).json({ error: 'create-failed', message: 'Gerät konnte nicht erstellt werden' });
    return;
  }
});

// PATCH /api/devices/:id - Update device (auth required)
router.patch('/:id', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = UpdateDeviceSchema.parse(req.body);
    const device = await prisma.device.update({
      where: { id: str(req.params.id)! },
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
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error updating device:', error);
    res.status(500).json({ error: 'update-failed', message: 'Gerät konnte nicht aktualisiert werden' });
    return;
  }
});

// DELETE /api/devices/:id - Delete device (auth required)
router.delete('/:id', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.device.findUnique({
      where: { id: str(req.params.id)! },
      select: { id: true, name: true, mode: true },
    });

    await prisma.device.delete({ where: { id: str(req.params.id)! } });
    await deleteDeviceSnapshot(str(req.params.id)!);

    broadcastDeviceUpdate({ id: str(req.params.id)!, deleted: true });
    await logAuditEvent(req, {
      action: 'device.delete',
      resource: str(req.params.id)!,
      details: existing,
    });

    res.json({ ok: true });
    return;
  } catch (error) {
    console.error('[devices] Error deleting device:', error);
    res.status(500).json({ error: 'delete-failed', message: 'Gerät konnte nicht gelöscht werden' });
    return;
  }
});

// POST /api/devices/:id/revoke-token - Revoke device token without deleting device
router.post('/:id/revoke-token', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: str(req.params.id)! },
      select: { id: true, name: true, tokenRevokedAt: true },
    });

    if (!device) {
      return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
    }

    await prisma.device.update({
      where: { id: str(req.params.id)! },
      data: { tokenRevokedAt: new Date() },
    });

    broadcastDeviceCommand(str(req.params.id)!, { command: 'reconnect' });

    await logAuditEvent(req, {
      action: 'device.token-revoked',
      resource: str(req.params.id)!,
      details: { deviceId: device.id, deviceName: device.name },
    });

    res.json({ ok: true, message: 'Device-Token wurde widerrufen' });
    return;
  } catch (error) {
    console.error('[devices] Error revoking device token:', error);
    res.status(500).json({ error: 'revoke-failed', message: 'Token konnte nicht widerrufen werden' });
    return;
  }
});

// POST /api/devices/:id/heartbeat - Device heartbeat
router.post('/:id/heartbeat', deviceAuthMiddleware, heartbeatLimiter, async (req: AuthRequest, res) => {
  try {
    await prisma.device.update({
      where: { id: str(req.params.id)! },
      data: { lastSeen: new Date() },
    });

    res.json({ ok: true });
    return;
  } catch (error) {
    console.error('[devices] Heartbeat error:', error);
    res.status(500).json({ error: 'update-failed', message: 'Gerät konnte nicht aktualisiert werden' });
    return;
  }
});

// POST /api/devices/:id/control - Send control command (auth required)
router.post('/:id/control', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = ControlCommandSchema.parse(req.body);

    broadcastDeviceCommand(str(req.params.id)!, { command: validated.action });
    await logAuditEvent(req, {
      action: 'device.command',
      resource: str(req.params.id)!,
      details: { command: validated.action },
    });

    res.json({ ok: true });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error sending control command:', error);
    res.status(500).json({ error: 'command-failed', message: 'Befehl konnte nicht ausgeführt werden' });
    return;
  }
});

// POST /api/devices/:id/overrides - Set device schedule override (auth required)
// Device-level overrides are scoped to the schedule only. Design/theme/slideshow
// customisations flow to devices via the `device.slideshowId` assignment.
router.post('/:id/overrides', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = OverridesSchema.parse(req.body);

    await prisma.deviceOverride.upsert({
      where: { deviceId: str(req.params.id)!! },
      create: {
        deviceId: str(req.params.id)!!,
        schedule: validated.schedule as unknown as Prisma.InputJsonValue,
      },
      update: {
        schedule: validated.schedule as unknown as Prisma.InputJsonValue,
      },
    });

    const device = await prisma.device.findUnique({
      where: { id: str(req.params.id)! },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (device) {
      broadcastDeviceUpdate(device);
    } else {
      broadcastDeviceUpdate({ id: str(req.params.id)!, overridesUpdated: true });
    }
    await logAuditEvent(req, {
      action: 'device.override.update',
      resource: str(req.params.id)!,
      details: {
        hasSchedule: true,
      },
    });

    res.json({ ok: true });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error setting overrides:', error);
    res.status(500).json({ error: 'overrides-failed', message: 'Überschreibungen konnten nicht gespeichert werden' });
    return;
  }
});

// DELETE /api/devices/:id/overrides - Clear device overrides (auth required)
router.delete('/:id/overrides', authMiddleware, requirePermission('devices:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    await prisma.deviceOverride.deleteMany({ where: { deviceId: str(req.params.id)!! } });

    const device = await prisma.device.findUnique({
      where: { id: str(req.params.id)! },
      include: DEVICE_ADMIN_INCLUDE,
    });

    if (device) {
      broadcastDeviceUpdate(device);
    } else {
      broadcastDeviceUpdate({ id: str(req.params.id)!, overridesCleared: true });
    }
    await logAuditEvent(req, {
      action: 'device.override.clear',
      resource: str(req.params.id)!,
    });

    res.json({ ok: true });
    return;
  } catch (error) {
    console.error('[devices] Error clearing overrides:', error);
    res.status(500).json({ error: 'clear-overrides-failed', message: 'Überschreibungen konnten nicht gelöscht werden' });
    return;
  }
});

export default router;
