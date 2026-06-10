import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createVersionedRecord } from '../lib/versionedEntity.js';
import { authMiddleware, type AuthRequest, str } from '../lib/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requirePermission } from '../lib/permissions.js';
import { listAuditLogs, logAuditEvent } from '../lib/audit.js';
import { mutationLimiter } from '../lib/rateLimiter.js';
import {
  buildGlobalSettingsWorkflowPayload,
  buildLiveGlobalWorkflowSnapshot,
  buildWorkflowActionAuditDetails,
  buildWorkflowHistoryDeleteAuditDetails,
  createWorkflowHistoryEntry,
  getCurrentWorkflowDraftEntry,
  getWorkflowTargetNameFromDetails,
  HISTORY_ACTIONS,
  matchesWorkflowTarget,
  normalizeWorkflowSnapshot,
  type WorkflowSnapshot,
  WORKFLOW_ACTIONS,
  WorkflowSnapshotSchema,
  WorkflowTargetSchema,
} from '../lib/slideshowWorkflow.js';
import { broadcastSettingsUpdate } from '../websocket/index.js';
import { invalidateGlobalConfigCache } from '../lib/globalConfigCache.js';

const router = Router();

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
  const currentActive = await prisma.settings.findFirst({
    where: { isActive: true },
    orderBy: { version: 'desc' },
  });
  const payload = buildGlobalSettingsWorkflowPayload(currentActive?.data, snapshot);
  const { id: createdId, version: nextVersion } = await createVersionedRecord('settings', payload);

  invalidateGlobalConfigCache();
  broadcastSettingsUpdate(payload);
  await logAuditEvent(req, {
    action,
    resource: createdId,
    details: buildWorkflowActionAuditDetails({
      targetType: 'global',
      targetName: 'Globale Slideshow',
      settingsVersion: nextVersion,
      sourceHistoryId: sourceHistoryId || null,
      snapshot,
    }),
  });

  return { ok: true, settingsVersion: nextVersion };
}

async function publishDevice(
  _req: AuthRequest,
  _targetId: string,
  _snapshot: WorkflowSnapshot,
  _action: 'slideshow.publish' | 'slideshow.rollback',
  _sourceHistoryId?: string,
) {
  // Device-scoped slideshow publishing has been retired. Slideshows are now
  // first-class entities — assign one to a device via `device.slideshowId`
  // instead (PATCH /api/devices/:id). This stub exists so the route handlers
  // keep compiling; the dispatcher below returns 410 Gone for device targets.
  return {
    status: 410 as const,
    body: {
      error: 'gone',
      message: 'Gerätespezifisches Slideshow-Publishing wurde entfernt. Weise dem Gerät stattdessen eine Slideshow über `slideshowId` zu.',
    },
  };
}

router.get('/workflow', authMiddleware, requirePermission('slideshow:manage'), asyncHandler(async (req: AuthRequest, res) => {
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

  const relevantLogs = auditResult.items.filter((log) => matchesWorkflowTarget(log.details, targetType, targetId));
  const draftLog = getCurrentWorkflowDraftEntry(relevantLogs);
  const draftEntry = draftLog ? createWorkflowHistoryEntry(draftLog) : null;
  const history = relevantLogs
    .filter((log) => log.action === 'slideshow.publish' || log.action === 'slideshow.rollback')
    .map((log) => createWorkflowHistoryEntry(log))
    .filter(Boolean)
    .slice(0, 12);

  if (targetType === 'device' && targetId && !device) {
    return res.status(404).json({ error: 'not-found', message: 'Gerät nicht gefunden' });
  }

  // Device-scoped slideshow workflows no longer have a distinct "live"
  // snapshot — the device shows whatever slideshow is attached via
  // `device.slideshowId`. Falling back to the global snapshot so the
  // workflow panel stays usable while legacy device targets are retired.
  const liveSnapshot = targetType === 'global'
    ? buildLiveGlobalWorkflowSnapshot(activeSettings?.data)
    : buildLiveGlobalWorkflowSnapshot(activeSettings?.data);

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
}));

router.post('/workflow/draft', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const validated = SaveDraftSchema.parse(req.body);
  const snapshot = normalizeWorkflowSnapshot(validated);
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
    details: buildWorkflowActionAuditDetails({
      targetType: validated.targetType,
      targetId: validated.targetType === 'global' ? null : validated.targetId,
      targetName,
      deviceMode,
      snapshot,
    }),
  });

  return res.json({ ok: true, savedAt: new Date().toISOString() });
}));

router.post('/workflow/discard', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
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
    details: buildWorkflowActionAuditDetails({
      targetType: validated.targetType,
      targetId: validated.targetType === 'global' ? null : validated.targetId,
      targetName,
      deviceMode,
    }),
  });

  return res.json({ ok: true });
}));

router.delete('/workflow/history/:historyId', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const validated = DeleteHistorySchema.parse({
    targetType: req.query.targetType,
    targetId: req.query.targetId,
    historyId: str(req.params.historyId),
  });
  const targetId = validated.targetType === 'device' ? validated.targetId : null;
  const log = await findHistoryLog(validated.historyId);

  if (!log || !HISTORY_ACTIONS.includes(log.action as typeof HISTORY_ACTIONS[number])) {
    return res.status(404).json({ error: 'not-found', message: 'Verlaufseintrag nicht gefunden' });
  }

  if (!matchesWorkflowTarget(log.details, validated.targetType, targetId)) {
    return res.status(404).json({ error: 'not-found', message: 'Verlaufseintrag gehört nicht zu diesem Ziel' });
  }

  await prisma.auditLog.delete({
    where: { id: validated.historyId },
  });

  await logAuditEvent(req, {
    action: 'slideshow.history.delete',
    resource: validated.historyId,
    details: buildWorkflowHistoryDeleteAuditDetails({
      targetType: validated.targetType,
      targetId,
      deletedAction: log.action,
      deletedTimestamp: log.timestamp,
      targetName: getWorkflowTargetNameFromDetails(log.details),
    }),
  });

  return res.json({ ok: true });
}));

router.post('/workflow/publish', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const validated = PublishSchema.parse(req.body);
  const snapshot = normalizeWorkflowSnapshot(validated);
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
}));

router.post('/workflow/rollback', authMiddleware, requirePermission('slideshow:manage'), mutationLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const validated = RollbackSchema.parse(req.body);
  const snapshot = normalizeWorkflowSnapshot(validated.snapshot);
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
}));

export default router;
