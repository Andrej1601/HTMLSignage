import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { broadcastDeviceUpdate } from '../../websocket/index.js';
import { authMiddleware, generateDeviceToken, type AuthRequest } from '../../lib/auth.js';
import { requirePermission } from '../../lib/permissions.js';
import { mutationLimiter, pairingRequestLimiter } from '../../lib/rateLimiter.js';
import { logAuditEvent } from '../../lib/audit.js';
import {
  buildDevicePairAuditDetails,
  generateUniquePairingCode,
  normalizeDeviceGroupName,
  readDeviceFleetState,
} from '../../lib/deviceManagement.js';
import { DEVICE_ADMIN_INCLUDE, DEFAULT_DEVICE_LIMIT, MAX_DEVICE_LIMIT } from './shared.js';

const router = Router();

const RequestPairingSchema = z.object({
  browserId: z.string().min(20).max(128),
});

const PairDeviceSchema = z.object({
  pairingCode: z.string().length(6),
  name: z.string().trim().min(1).optional(),
  groupName: z.string().trim().max(80).nullable().optional(),
});

// GET /api/devices/pending - Get all devices pending pairing (admin only)
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

// POST /api/devices/request-pairing - Request a pairing code (called by unpaired device)
router.post('/request-pairing', pairingRequestLimiter, async (req, res) => {
  try {
    const validated = RequestPairingSchema.parse(req.body);
    const { browserId } = validated;
    const deviceToken = generateDeviceToken(browserId);

    let device = await prisma.device.findUnique({ where: { id: browserId } });

    if (device) {
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

    const pairedDevice = await prisma.device.update({
      where: { id: device.id },
      data: {
        name: validated.name || device.name,
        groupName: normalizeDeviceGroupName(validated.groupName),
        pairedBy: req.userId,
        pairedAt: new Date(),
        pairingCode: null,
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
