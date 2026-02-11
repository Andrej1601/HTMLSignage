import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { broadcastDeviceUpdate } from '../websocket/index.js';
import { authMiddleware, generatePairingCode, type AuthRequest } from '../lib/auth.js';

const router = Router();

const CreateDeviceSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(['auto', 'override']).optional().default('auto'),
});

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).optional(),
  mode: z.enum(['auto', 'override']).optional(),
});

const ControlCommandSchema = z.object({
  action: z.enum(['reload', 'restart', 'clear-cache']),
});

const OverridesSchema = z.object({
  schedule: z.any().optional(),
  settings: z.any().optional(),
});

// GET /api/devices - List all devices
router.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        user: {
          select: { username: true },
        },
        overrides: true,
      },
      orderBy: { lastSeen: 'desc' },
    });

    res.json(devices);
  } catch (error) {
    console.error('[devices] Error listing:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// GET /api/devices/pending - Get all devices pending pairing (admin only)
// IMPORTANT: Must be before /:id route to avoid "pending" being interpreted as an ID
router.get('/pending', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const devices = await prisma.device.findMany({
      where: {
        pairedAt: null,
        pairingCode: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(devices);
  } catch (error) {
    console.error('[devices] Error fetching pending devices:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// GET /api/devices/:id - Get device details
router.get('/:id', async (req, res) => {
  try {
    const device = await prisma.device.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { username: true } },
        overrides: true,
      },
    });

    if (!device) {
      return res.status(404).json({ error: 'not-found' });
    }

    res.json(device);
  } catch (error) {
    console.error('[devices] Error fetching device:', error);
    res.status(500).json({ error: 'fetch-failed' });
  }
});

// POST /api/devices - Create new device (pairing)
router.post('/', async (req, res) => {
  try {
    const validated = CreateDeviceSchema.parse(req.body);

    const device = await prisma.device.create({
      data: {
        name: validated.name,
        mode: validated.mode,
        pairedAt: new Date(),
      },
      include: {
        overrides: true,
      },
    });

    broadcastDeviceUpdate(device);

    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error creating device:', error);
    res.status(500).json({ error: 'create-failed' });
  }
});

// PATCH /api/devices/:id - Update device
router.patch('/:id', async (req, res) => {
  try {
    const validated = UpdateDeviceSchema.parse(req.body);

    const device = await prisma.device.update({
      where: { id: req.params.id },
      data: validated,
      include: {
        overrides: true,
      },
    });

    broadcastDeviceUpdate(device);

    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error updating device:', error);
    res.status(500).json({ error: 'update-failed' });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', async (req, res) => {
  try {
    await prisma.device.delete({
      where: { id: req.params.id },
    });

    broadcastDeviceUpdate({ id: req.params.id, deleted: true });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Error deleting device:', error);
    res.status(500).json({ error: 'delete-failed' });
  }
});

// POST /api/devices/:id/heartbeat - Device heartbeat
router.post('/:id/heartbeat', async (req, res) => {
  try {
    await prisma.device.update({
      where: { id: req.params.id },
      data: { lastSeen: new Date() },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Heartbeat error:', error);
    res.status(500).json({ error: 'update-failed' });
  }
});

// POST /api/devices/:id/control - Send control command
router.post('/:id/control', async (req, res) => {
  try {
    const validated = ControlCommandSchema.parse(req.body);

    // Broadcast control command via WebSocket
    broadcastDeviceUpdate({
      id: req.params.id,
      command: validated.action,
    });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error sending control command:', error);
    res.status(500).json({ error: 'command-failed' });
  }
});

// POST /api/devices/:id/overrides - Set device overrides
router.post('/:id/overrides', async (req, res) => {
  try {
    const validated = OverridesSchema.parse(req.body);

    const override = await prisma.deviceOverride.upsert({
      where: { deviceId: req.params.id },
      create: {
        deviceId: req.params.id,
        schedule: validated.schedule || {},
        settings: validated.settings || {},
      },
      update: {
        schedule: validated.schedule,
        settings: validated.settings,
      },
    });

    // Update device mode to 'override'
    await prisma.device.update({
      where: { id: req.params.id },
      data: { mode: 'override' },
    });

    broadcastDeviceUpdate({ id: req.params.id, overridesUpdated: true });

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error setting overrides:', error);
    res.status(500).json({ error: 'overrides-failed' });
  }
});

// DELETE /api/devices/:id/overrides - Clear device overrides
router.delete('/:id/overrides', async (req, res) => {
  try {
    await prisma.deviceOverride.deleteMany({
      where: { deviceId: req.params.id },
    });

    // Update device mode to 'auto'
    await prisma.device.update({
      where: { id: req.params.id },
      data: { mode: 'auto' },
    });

    broadcastDeviceUpdate({ id: req.params.id, overridesCleared: true });

    res.json({ ok: true });
  } catch (error) {
    console.error('[devices] Error clearing overrides:', error);
    res.status(500).json({ error: 'clear-overrides-failed' });
  }
});

// ============================================================================
// Device Pairing
// ============================================================================

const PairDeviceSchema = z.object({
  pairingCode: z.string().length(6),
  name: z.string().min(1).optional(),
});

// POST /api/devices/request-pairing - Request a pairing code (called by unpaired device)
router.post('/request-pairing', async (req, res) => {
  try {
    const { browserId } = req.body;

    if (!browserId) {
      return res.status(400).json({ error: 'browser-id-required', message: 'Browser ID is required' });
    }

    // Check if device with this browser ID already exists
    let device = await prisma.device.findUnique({ where: { id: browserId } });

    if (device) {
      // Device exists - return current status
      return res.json({
        id: device.id,
        pairingCode: device.pairingCode,
        paired: !!device.pairedAt,
        name: device.name,
      });
    }

    // Generate deterministic pairing code from browser ID (first 6 digits of hash)
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(browserId).digest('hex');
    let pairingCode = parseInt(hash.substring(0, 8), 16).toString().substring(0, 6).padStart(6, '0');

    // Ensure code is unique (very unlikely collision, but check anyway)
    let existingCode = await prisma.device.findUnique({ where: { pairingCode } });
    let attempt = 0;
    while (existingCode && attempt < 10) {
      const hashAttempt = crypto.createHash('sha256').update(browserId + attempt).digest('hex');
      pairingCode = parseInt(hashAttempt.substring(0, 8), 16).toString().substring(0, 6).padStart(6, '0');
      existingCode = await prisma.device.findUnique({ where: { pairingCode } });
      attempt++;
    }

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
    });
  } catch (error) {
    console.error('[devices] Error requesting pairing:', error);
    res.status(500).json({ error: 'pairing-request-failed' });
  }
});

// POST /api/devices/pair - Pair a device using pairing code (called by admin)
router.post('/pair', authMiddleware, async (req: AuthRequest, res) => {
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
        pairedBy: req.userId,
        pairedAt: new Date(),
        pairingCode: null, // Clear pairing code after successful pairing
      },
      include: {
        user: {
          select: { username: true },
        },
        overrides: true,
      },
    });

    broadcastDeviceUpdate({ ...pairedDevice, paired: true });

    res.json(pairedDevice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[devices] Error pairing device:', error);
    res.status(500).json({ error: 'pairing-failed' });
  }
});

export default router;
