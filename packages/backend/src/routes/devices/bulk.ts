import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { broadcastDeviceCommand, broadcastDeviceUpdate } from '../../websocket/index.js';
import { authMiddleware, type AuthRequest } from '../../lib/auth.js';
import { requirePermission } from '../../lib/permissions.js';
import { mutationLimiter } from '../../lib/rateLimiter.js';
import { logAuditEvent } from '../../lib/audit.js';
import {
  buildBulkDeviceCommandAuditDetails,
  buildBulkDeviceUpdateAuditDetails,
  buildBulkDeviceUpdateData,
} from '../../lib/deviceManagement.js';
import { DeviceIdListSchema, ControlCommandSchema, loadAdminDevicesByIds, findMissingEntityIds } from './shared.js';

const router = Router();

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
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error bulk updating devices:', error);
    return res.status(500).json({ error: 'bulk-update-failed', message: 'Geräte konnten nicht gesammelt aktualisiert werden' });
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
      return res.status(400).json({ error: 'validation-failed', details: error.issues });
    }
    console.error('[devices] Error sending bulk control command:', error);
    return res.status(500).json({ error: 'bulk-command-failed', message: 'Befehle konnten nicht an die Geräte gesendet werden' });
  }
});

export default router;
