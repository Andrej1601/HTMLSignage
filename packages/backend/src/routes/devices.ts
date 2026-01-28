import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { broadcastDeviceUpdate } from '../websocket/index.js';

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

export default router;
