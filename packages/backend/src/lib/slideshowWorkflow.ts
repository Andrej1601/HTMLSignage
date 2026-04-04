import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { isPlainRecord } from './utils.js';

export const WORKFLOW_ACTIONS = [
  'slideshow.draft.save',
  'slideshow.draft.discard',
  'slideshow.publish',
  'slideshow.rollback',
] as const;

export const HISTORY_ACTIONS = ['slideshow.publish', 'slideshow.rollback'] as const;

export type WorkflowAction = typeof WORKFLOW_ACTIONS[number];
export type WorkflowTargetType = 'global' | 'device';

const SlideshowConfigSchema = z.object({
  version: z.number().optional(),
  layout: z.string().optional(),
  slides: z.array(z.object({
    id: z.string(),
    type: z.string(),
    enabled: z.boolean(),
    duration: z.number(),
    order: z.number(),
  }).catchall(z.unknown())).optional(),
  defaultDuration: z.number().optional(),
  defaultTransition: z.string().optional(),
  enableTransitions: z.boolean().optional(),
}).catchall(z.unknown());

const AudioSettingsSchema = z.object({
  enabled: z.boolean(),
  src: z.string().optional(),
  mediaId: z.string().optional(),
  volume: z.number(),
  loop: z.boolean(),
}).catchall(z.unknown());

export const WorkflowSnapshotSchema = z.object({
  config: SlideshowConfigSchema,
  prestartMinutes: z.number().min(0).max(120),
  audioOverride: AudioSettingsSchema.nullable().optional(),
});

export const WorkflowTargetSchema = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('global'),
  }),
  z.object({
    targetType: z.literal('device'),
    targetId: z.string().min(1),
  }),
]);

export interface WorkflowSnapshot {
  config: Record<string, unknown>;
  prestartMinutes: number;
  audioOverride: Record<string, unknown> | null;
}

export interface WorkflowHistoryEntry {
  id: string;
  action: WorkflowAction;
  timestamp: Date;
  snapshot: WorkflowSnapshot;
  user: { id: string; username: string; email: string | null } | null;
  metadata: {
    settingsVersion: number | null;
    deviceMode: string | null;
    targetName: string | null;
  };
}

export function cloneWorkflowJson<T>(value: T): T {
  return structuredClone(value) as T;
}

export function normalizeWorkflowSnapshot(raw: unknown): WorkflowSnapshot | null {
  const parsed = WorkflowSnapshotSchema.safeParse(raw);
  if (!parsed.success) return null;

  return {
    config: cloneWorkflowJson(parsed.data.config) as Record<string, unknown>,
    prestartMinutes: parsed.data.prestartMinutes,
    audioOverride: parsed.data.audioOverride
      ? cloneWorkflowJson(parsed.data.audioOverride) as Record<string, unknown>
      : null,
  };
}

function getWorkflowDetailsTarget(details: unknown): { targetType: WorkflowTargetType; targetId: string | null } | null {
  if (!isPlainRecord(details)) return null;
  const targetType = details.targetType;
  const targetId = details.targetId;
  if (targetType !== 'global' && targetType !== 'device') return null;
  return {
    targetType,
    targetId: typeof targetId === 'string' && targetId.trim() !== '' ? targetId : null,
  };
}

export function matchesWorkflowTarget(
  details: unknown,
  targetType: WorkflowTargetType,
  targetId: string | null,
): boolean {
  const target = getWorkflowDetailsTarget(details);
  if (!target || target.targetType !== targetType) return false;
  if (targetType === 'global') return true;
  return target.targetId === targetId;
}

export function getWorkflowSnapshotFromDetails(details: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(details)) return null;
  return normalizeWorkflowSnapshot(details.snapshot);
}

export function getWorkflowTargetNameFromDetails(details: unknown): string | null {
  if (!isPlainRecord(details) || typeof details.targetName !== 'string') {
    return null;
  }
  const value = details.targetName.trim();
  return value.length > 0 ? value : null;
}

export function toWorkflowAuditDetails(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

export function buildWorkflowActionAuditDetails(input: {
  targetType: WorkflowTargetType;
  targetId?: string | null;
  targetName: string;
  deviceMode?: string | null;
  sourceHistoryId?: string | null;
  snapshot?: WorkflowSnapshot;
  settingsVersion?: number | null;
}): Prisma.InputJsonValue {
  return toWorkflowAuditDetails({
    targetType: input.targetType,
    targetId: input.targetType === 'global' ? null : (input.targetId ?? null),
    targetName: input.targetName,
    deviceMode: input.deviceMode ?? null,
    sourceHistoryId: input.sourceHistoryId ?? null,
    settingsVersion: input.settingsVersion ?? null,
    ...(input.snapshot ? { snapshot: input.snapshot } : {}),
  });
}

export function buildWorkflowHistoryDeleteAuditDetails(input: {
  targetType: WorkflowTargetType;
  targetId?: string | null;
  deletedAction: string;
  deletedTimestamp: Date;
  targetName?: string | null;
}): Prisma.InputJsonValue {
  return toWorkflowAuditDetails({
    targetType: input.targetType,
    targetId: input.targetType === 'global' ? null : (input.targetId ?? null),
    deletedAction: input.deletedAction,
    deletedTimestamp: input.deletedTimestamp,
    targetName: input.targetName ?? null,
  });
}

export function getCurrentWorkflowDraftEntry<T extends { action: string; details: unknown }>(logs: T[]): T | null {
  for (const log of logs) {
    if (log.action === 'slideshow.draft.save') {
      return getWorkflowSnapshotFromDetails(log.details) ? log : null;
    }
    if (log.action === 'slideshow.publish' || log.action === 'slideshow.rollback' || log.action === 'slideshow.draft.discard') {
      return null;
    }
  }
  return null;
}

export function getSlideshowVersion(raw: unknown): number {
  if (!isPlainRecord(raw)) return 1;
  const value = raw.version;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function normalizeDisplaySettings(raw: unknown): Record<string, unknown> {
  return isPlainRecord(raw) ? { ...raw } : {};
}

export function buildGlobalSettingsWorkflowPayload(
  baseData: unknown,
  snapshot: WorkflowSnapshot,
): Record<string, unknown> {
  const next = isPlainRecord(baseData) ? cloneWorkflowJson(baseData) as Record<string, unknown> : {};
  const currentSlideshow = isPlainRecord(next.slideshow) ? next.slideshow : {};
  next.display = {
    ...normalizeDisplaySettings(next.display),
    prestartMinutes: snapshot.prestartMinutes,
  };
  next.slideshow = {
    ...cloneWorkflowJson(snapshot.config),
    version: getSlideshowVersion(currentSlideshow) + 1,
  };
  return next;
}

export function buildDeviceWorkflowOverrideSettings(
  baseSettings: unknown,
  snapshot: WorkflowSnapshot,
): Record<string, unknown> {
  const next = isPlainRecord(baseSettings) ? cloneWorkflowJson(baseSettings) as Record<string, unknown> : {};
  const currentSlideshow = isPlainRecord(next.slideshow) ? next.slideshow : {};
  next.display = {
    ...normalizeDisplaySettings(next.display),
    prestartMinutes: snapshot.prestartMinutes,
  };
  next.slideshow = {
    ...cloneWorkflowJson(snapshot.config),
    version: getSlideshowVersion(currentSlideshow) + 1,
  };

  if (snapshot.audioOverride) {
    next.audio = cloneWorkflowJson(snapshot.audioOverride);
  } else {
    delete next.audio;
  }

  return next;
}

export function buildLiveGlobalWorkflowSnapshot(settingsData: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(settingsData)) return null;
  const slideshow = isPlainRecord(settingsData.slideshow)
    ? cloneWorkflowJson(settingsData.slideshow) as Record<string, unknown>
    : null;
  if (!slideshow) return null;
  const display = normalizeDisplaySettings(settingsData.display);
  return {
    config: slideshow,
    prestartMinutes: typeof display.prestartMinutes === 'number' ? display.prestartMinutes : 10,
    audioOverride: null,
  };
}

export function buildLiveDeviceWorkflowSnapshot(settingsData: unknown): WorkflowSnapshot | null {
  if (!isPlainRecord(settingsData)) return null;
  const slideshow = isPlainRecord(settingsData.slideshow)
    ? cloneWorkflowJson(settingsData.slideshow) as Record<string, unknown>
    : null;
  if (!slideshow) return null;
  const display = normalizeDisplaySettings(settingsData.display);
  const audioOverride = isPlainRecord(settingsData.audio)
    ? cloneWorkflowJson(settingsData.audio) as Record<string, unknown>
    : null;
  return {
    config: slideshow,
    prestartMinutes: typeof display.prestartMinutes === 'number' ? display.prestartMinutes : 10,
    audioOverride,
  };
}

export function createWorkflowHistoryEntry(log: {
  id: string;
  action: string;
  timestamp: Date;
  user: { id: string; username: string; email: string | null } | null;
  details: Prisma.JsonValue | null;
}): WorkflowHistoryEntry | null {
  const snapshot = getWorkflowSnapshotFromDetails(log.details);
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
      targetName: getWorkflowTargetNameFromDetails(details),
    },
  };
}
