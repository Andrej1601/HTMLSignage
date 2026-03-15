import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, type AuthRequest } from '../lib/auth.js';
import { requirePermission } from '../lib/permissions.js';
import { listAuditLogs, logAuditEvent } from '../lib/audit.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import { isPlainRecord } from '../lib/utils.js';
import { broadcastDeviceUpdate, broadcastSettingsUpdate } from '../websocket/index.js';

const router = Router();
const WORKFLOW_ACTIONS = [
  'slideshow.draft.save',
  'slideshow.draft.discard',
  'slideshow.publish',
  'slideshow.rollback',
] as const;
const HISTORY_ACTIONS = ['slideshow.publish', 'slideshow.rollback'] as const;

type WorkflowAction = typeof WORKFLOW_ACTIONS[number];
type WorkflowTargetType = 'global' | 'device';

const SlideshowConfigSchema = z.object({
  version: z.number().optional(),
  layout: z.string().optional(),
  slides: z.array(z.object({
    id: z.string(),
    type: z.string(),
    enabled: z.boolean(),
    duration: z.number(),
    order: z.number(),
  }).passthrough()).optional(),
  defaultDuration: z.number().optional(),
  defaultTransition: z.string().optional(),
  enableTransitions: z.boolean().optional(),
}).passthrough();

const AudioSettingsSchema = z.object({
  enabled: z.boolean(),
  src: z.string().optional(),
  mediaId: z.string().optional(),
  volume: z.number(),
  loop: z.boolean(),
}).passthrough();

const WorkflowSnapshotSchema = z.object({
  config: SlideshowConfigSchema,
  prestartMinutes: z.number().min(0).max(120),
  audioOverride: AudioSettingsSchema.nullable().optional(),
});

const WorkflowTargetSchema = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('global'),
  }),
  z.object({
    targetType: z.literal('device'),
    targetId: z.string().min(1),
  }),
]);

const SaveDraftSchema = z.intersection(WorkflowTargetSchema, WorkflowSnapshotSchema);
const PublishSchema = z.intersection(WorkflowTargetSchema, WorkflowSnapshotSchema);
const RollbackSchema = z.intersection(
  WorkflowTargetSchema,
  z.object({
    sourceHistoryId: z.string().min(1),
    snapshot: WorkflowSnapshotSchema,
  }),
);
const DiscardDraftSchema = WorkflowTargetSchema;
const QuerySchema = WorkflowTargetSchema;
const DeleteHistorySchema = z.intersection(
  WorkflowTargetSchema,
  z.object({
    historyId: z.string().min(1),
  }),
);

interface WorkflowSnapshot {
  config: Record<string, unknown>;
  prestartMinutes: number;
  audioOverride: Record<string, unknown> | null;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeSnapshot(raw: unknown): WorkflowSnapshot | null {
  const parsed = WorkflowSnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;

  return {
    config: cloneJson(parsed.data.config) as Record<string, unknown>,
    prestartMinutes: parsed.data.prestartMinutes,
    audioOverride: parsed.data.audioOverride ? cloneJson(parsed.data.audioOverride) as Record<string, unknown> : null,
  };
}

function getDetailsTarget(details: unknown): { targetType: WorkflowTargetType; targetId: string | null } | null {
  if (!isPlainRecord(details)) return null;
  const targetType = details.targetType;
  const targetId = details.targetId;
  if (targetType !== 'global' && targetType !== 'device') return null;
  return {
    targetType,
    targetId: typeof targetId === 'string' && targetId.trim() !== '' ? targetId : null,
  };
}

function matchesTarget(details: unknown, targetType: WorkflowTargetType, targetId: string | null): boolean {
  const target = getDetailsTarget(details);
  if (!target || target.targetType !== targetType) return false;
  if (targetType === 'global') return true;
  return target.targetId === targetId;
}

function getSnapshotFromDetails(details: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(details)) return null;
  return normalizeSnapshot(details.snapshot);
}

function toAuditDetails(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getCurrentDraftEntry<T extends { action: string; details: unknown }>(logs: T[]): T | null {
  for (const log of logs) {
    if (log.action === 'slideshow.draft.save') {
      return getSnapshotFromDetails(log.details) ? log : null;
    }
    if (log.action === 'slideshow.publish' || log.action === 'slideshow.rollback' || log.action === 'slideshow.draft.discard') {
      return null;
    }
  }
  return null;
}

function getSlideshowVersion(raw: unknown): number {
  if (!isPlainRecord(raw)) return 1;
  const value = raw.version;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizeDisplaySettings(raw: unknown): Record<string, unknown> {
  return isPlainRecord(raw) ? { ...raw } : {};
}

function buildGlobalSettingsPayload(baseData: unknown, snapshot: WorkflowSnapshot): Record<string, unknown> {
  const next = isPlainRecord(baseData) ? cloneJson(baseData) as Record<string, unknown> : {};
  const currentSlideshow = isPlainRecord(next.slideshow) ? next.slideshow : {};
  next.display = {
    ...normalizeDisplaySettings(next.display),
    prestartMinutes: snapshot.prestartMinutes,
  };
  next.slideshow = {
    ...cloneJson(snapshot.config),
    version: getSlideshowVersion(currentSlideshow) + 1,
  };
  return next;
}

function buildDeviceOverrideSettings(baseSettings: unknown, snapshot: WorkflowSnapshot): Record<string, unknown> {
  const next = isPlainRecord(baseSettings) ? cloneJson(baseSettings) as Record<string, unknown> : {};
  const currentSlideshow = isPlainRecord(next.slideshow) ? next.slideshow : {};
  next.display = {
    ...normalizeDisplaySettings(next.display),
    prestartMinutes: snapshot.prestartMinutes,
  };
  next.slideshow = {
    ...cloneJson(snapshot.config),
    version: getSlideshowVersion(currentSlideshow) + 1,
  };

  if (snapshot.audioOverride) {
    next.audio = cloneJson(snapshot.audioOverride);
  } else {
    delete next.audio;
  }

  return next;
}

function buildLiveGlobalSnapshot(settingsData: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(settingsData)) return null;
  const slideshow = isPlainRecord(settingsData.slideshow) ? cloneJson(settingsData.slideshow) as Record<string, unknown> : null;
  if (!slideshow) return null;
  const display = normalizeDisplaySettings(settingsData.display);
  return {
    config: slideshow,
    prestartMinutes: typeof display.prestartMinutes === 'number' ? display.prestartMinutes : 10,
    audioOverride: null,
  };
}

function buildLiveDeviceSnapshot(settingsData: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(settingsData)) return null;
  const slideshow = isPlainRecord(settingsData.slideshow) ? cloneJson(settingsData.slideshow) as Record<string, unknown> : null;
  if (!slideshow) return null;
  const display = normalizeDisplaySettings(settingsData.display);
  const audioOverride = isPlainRecord(settingsData.audio)
    ? cloneJson(settingsData.audio) as Record<string, unknown>
    : null;
  return {
    config: slideshow,
    prestartMinutes: typeof display.prestartMinutes === 'number' ? display.prestartMinutes : 10,
    audioOverride,
  };
}

function createWorkflowHistoryEntry(
  log: {
    id: string;
    action: string;
    timestamp: Date;
    user: { id: string; username: string; email: string | null } | null;
    details: Prisma.JsonValue | null;
  },
) {
  const snapshot = getSnapshotFromDetails(log.details);
  if (!snapshot) return null;
  const details = isPlainRecord(log.details) ? log.details : {};
  return {
    id: log.id,
    action: log.action as WorkflowAction,
    timestamp: log.timestamp,
    snapshot,
    user: log.user,
    metadata: {
      settingsVersion: typeof details.settingsVersion === 'number' ? details.settingsVersion : null,
      deviceMode: typeof details.deviceMode === 'string' ? details.deviceMode : null,
      targetName: typeof details.targetName === 'string' ? details.targetName : null,
    },
  };
}

async function findHistoryLog(historyId: string) {
  return await prisma.auditLog.findUnique({
    where: { id: historyId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });
}

async function publishGlobal(req: AuthRequest, snapshot: WorkflowSnapshot, action: 'slideshow.publish' | 'slideshow.rollback', sourceHistoryId?: string) {
  const [currentActive, latest] = await Promise.all([
    prisma.settings.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } }),
    prisma.settings.findFirst({ orderBy: { version: 'desc' }, select: { version: true } }),
  ]);
  const nextVersion = (latest?.version ?? 0) + 1;
  const payload = buildGlobalSettingsPayload(currentActive?.data, snapshot);
  payload.version = nextVersion;

  const created = await prisma.settings.create({
    data: {
      version: nextVersion,
      data: payload as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  await prisma.settings.updateMany({
    where: {
      id: { not: created.id },
      isActive: true,
    },
    data: { isActive: false },
  });

  broadcastSettingsUpdate(payload);
  await logAuditEvent(req, {
    action,
    resource: created.id,
    details: toAuditDetails({
      targetType: 'global',
      targetId: null,
      targetName: 'Globale Slideshow',
      settingsVersion: nextVersion,
      sourceHistoryId: sourceHistoryId || null,
      snapshot,
    }),
  });

  return { ok: true, settingsVersion: nextVersion };
}

async function publishDevice(
  req: AuthRequest,
  targetId: string,
  snapshot: WorkflowSnapshot,
  action: 'slideshow.publish' | 'slideshow.rollback',
  sourceHistoryId?: string,
) {
  const device = await prisma.device.findUnique({
    where: { id: targetId },
    include: { overrides: true, user: { select: { username: true } } },
  });

  if (!device) {
    return { status: 404 as const, body: { error: 'not-found', message: 'Gerät nicht gefunden' } };
  }

  const nextSettings = buildDeviceOverrideSettings(device.overrides?.settings, snapshot);
  const nextSchedule = isPlainRecord(device.overrides?.schedule)
    ? cloneJson(device.overrides?.schedule)
    : {};

  await prisma.deviceOverride.upsert({
    where: { deviceId: targetId },
    create: {
      deviceId: targetId,
      schedule: nextSchedule as Prisma.InputJsonValue,
      settings: nextSettings as Prisma.InputJsonValue,
    },
    update: {
      settings: nextSettings as Prisma.InputJsonValue,
      schedule: nextSchedule as Prisma.InputJsonValue,
    },
  });

  const refreshed = await prisma.device.findUnique({
    where: { id: targetId },
    include: { overrides: true, user: { select: { username: true } } },
  });

  if (refreshed) {
    broadcastDeviceUpdate(refreshed);
  }

  await logAuditEvent(req, {
    action,
    resource: targetId,
    details: toAuditDetails({
      targetType: 'device',
      targetId,
      targetName: device.name,
      deviceMode: device.mode,
      sourceHistoryId: sourceHistoryId || null,
      snapshot,
    }),
  });

  return { ok: true, deviceMode: device.mode };
}

router.get('/workflow', authMiddleware, requirePermission('slideshow:manage'), async (req: AuthRequest, res) => {
  try {
    const validated = QuerySchema.parse({
      targetType: req.query.targetType,
      targetId: req.query.targetId,
    });
    const targetType = validated.targetType;
    const targetId = validated.targetType === 'device' ? validated.targetId : null;

    const [auditResult, activeSettings, device] = await Promise.all([
      listAuditLogs({ limit: 200, actions: [...WORKFLOW_ACTIONS] }),
      targetType === 'global'
        ? prisma.settings.findFirst({ where: { isActive: true }, orderBy: { version: 'desc' } })
        : Promise.resolve(null),
      targetType === 'device' && targetId
        ? prisma.device.findUnique({ where: { id: targetId }, include: { overrides: true } })
        : Promise.resolve(null),
    ]);

    const relevantLogs = auditResult.items.filter((log) => matchesTarget(log.details, targetType, targetId));
    const draftLog = getCurrentDraftEntry(relevantLogs);
    const draftEntry = draftLog ? createWorkflowHistoryEntry(draftLog) : null;
    const history = relevantLogs
      .filter((log) => log.action === 'slideshow.publish' || log.action === 'slideshow.rollback')
      .map((log) => createWorkflowHistoryEntry(log))
      .filter(Boolean)
      .slice(0, 12);

    if (targetType === 'device' && targetId && !device) {
      return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
    }

    const liveSnapshot = targetType === 'global'
      ? buildLiveGlobalSnapshot(activeSettings?.data)
      : buildLiveDeviceSnapshot(device?.overrides?.settings);

    return res.json({
      ok: true,
      target: {
        targetType,
        targetId,
        name: targetType === 'global' ? 'Globale Slideshow' : (device?.name || 'Gerät'),
      },
      live: targetType === 'global'
        ? {
            updatedAt: activeSettings?.updatedAt ?? null,
            settingsVersion: activeSettings?.version ?? null,
            deviceMode: null,
            hasStoredOverride: false,
            snapshot: liveSnapshot,
          }
        : {
            updatedAt: device?.updatedAt ?? null,
            settingsVersion: null,
            deviceMode: device?.mode ?? null,
            hasStoredOverride: Boolean(device?.overrides && Object.keys(device.overrides).length > 0),
            snapshot: liveSnapshot,
          },
      draft: draftEntry,
      history,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error fetching state:', error);
    return res.status(500).json({ error: 'fetch-failed', message: 'Workflow-Status konnte nicht geladen werden' });
  }
});

router.post('/workflow/draft', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = SaveDraftSchema.parse(req.body);
    const snapshot = normalizeSnapshot(validated);
    if (!snapshot) {
      return res.status(400).json({ error: 'validation-failed', message: 'Entwurf ist ungültig' });
    }

    let targetName = 'Globale Slideshow';
    let deviceMode: string | null = null;

    if (validated.targetType === 'device') {
      const device = await prisma.device.findUnique({ where: { id: validated.targetId } });
      if (!device) {
        return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
      }
      targetName = device.name;
      deviceMode = device.mode;
    }

    await logAuditEvent(req, {
      action: 'slideshow.draft.save',
      resource: validated.targetType === 'global' ? null : validated.targetId,
      details: toAuditDetails({
        targetType: validated.targetType,
        targetId: validated.targetType === 'global' ? null : validated.targetId,
        targetName,
        deviceMode,
        snapshot,
      }),
    });

    return res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error saving draft:', error);
    return res.status(500).json({ error: 'save-failed', message: 'Entwurf konnte nicht gespeichert werden' });
  }
});

router.post('/workflow/discard', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = DiscardDraftSchema.parse(req.body);
    let targetName = 'Globale Slideshow';
    let deviceMode: string | null = null;

    if (validated.targetType === 'device') {
      const device = await prisma.device.findUnique({ where: { id: validated.targetId } });
      if (!device) {
        return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
      }
      targetName = device.name;
      deviceMode = device.mode;
    }

    await logAuditEvent(req, {
      action: 'slideshow.draft.discard',
      resource: validated.targetType === 'global' ? null : validated.targetId,
      details: toAuditDetails({
        targetType: validated.targetType,
        targetId: validated.targetType === 'global' ? null : validated.targetId,
        targetName,
        deviceMode,
      }),
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error discarding draft:', error);
    return res.status(500).json({ error: 'discard-failed', message: 'Entwurf konnte nicht verworfen werden' });
  }
});

router.delete('/workflow/history/:historyId', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = DeleteHistorySchema.parse({
      targetType: req.query.targetType,
      targetId: req.query.targetId,
      historyId: req.params.historyId,
    });
    const targetId = validated.targetType === 'device' ? validated.targetId : null;
    const log = await findHistoryLog(validated.historyId);

    if (!log || !HISTORY_ACTIONS.includes(log.action as typeof HISTORY_ACTIONS[number])) {
      return res.status(404).json({ error: 'not-found', message: 'Verlaufseintrag nicht gefunden' });
    }

    if (!matchesTarget(log.details, validated.targetType, targetId)) {
      return res.status(404).json({ error: 'not-found', message: 'Verlaufseintrag gehört nicht zu diesem Ziel' });
    }

    await prisma.auditLog.delete({
      where: { id: validated.historyId },
    });

    await logAuditEvent(req, {
      action: 'slideshow.history.delete',
      resource: validated.historyId,
      details: toAuditDetails({
        targetType: validated.targetType,
        targetId,
        deletedAction: log.action,
        deletedTimestamp: log.timestamp,
        targetName: isPlainRecord(log.details) && typeof log.details.targetName === 'string'
          ? log.details.targetName
          : null,
      }),
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error deleting history entry:', error);
    return res.status(500).json({ error: 'delete-failed', message: 'Verlaufseintrag konnte nicht gelöscht werden' });
  }
});

router.post('/workflow/publish', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = PublishSchema.parse(req.body);
    const snapshot = normalizeSnapshot(validated);
    if (!snapshot) {
      return res.status(400).json({ error: 'validation-failed', message: 'Slideshow-Stand ist ungültig' });
    }

    if (validated.targetType === 'global') {
      const result = await publishGlobal(req, snapshot, 'slideshow.publish');
      return res.json(result);
    }

    const result = await publishDevice(req, validated.targetId, snapshot, 'slideshow.publish');
    if ('status' in result && typeof result.status === 'number') {
      return res.status(result.status).json(result.body);
    }
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error publishing:', error);
    return res.status(500).json({ error: 'publish-failed', message: 'Slideshow konnte nicht veröffentlicht werden' });
  }
});

router.post('/workflow/rollback', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, async (req: AuthRequest, res) => {
  try {
    const validated = RollbackSchema.parse(req.body);
    const snapshot = normalizeSnapshot(validated.snapshot);
    if (!snapshot) {
      return res.status(400).json({ error: 'validation-failed', message: 'Rollback-Stand ist ungültig' });
    }

    if (validated.targetType === 'global') {
      const result = await publishGlobal(req, snapshot, 'slideshow.rollback', validated.sourceHistoryId);
      return res.json(result);
    }

    const result = await publishDevice(req, validated.targetId, snapshot, 'slideshow.rollback', validated.sourceHistoryId);
    if ('status' in result && typeof result.status === 'number') {
      return res.status(result.status).json(result.body);
    }
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'validation-failed', details: error.errors });
    }
    console.error('[slideshow-workflow] Error rolling back:', error);
    return res.status(500).json({ error: 'rollback-failed', message: 'Slideshow konnte nicht wiederhergestellt werden' });
  }
});

export default router;
