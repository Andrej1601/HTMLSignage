/**
 * Settings-Aggregate Sync.
 *
 * Saunas, aromas, info items, and events live in dedicated tables now,
 * but the public `/api/settings` API still returns + accepts them as
 * arrays inside the Settings JSON for backwards compatibility with the
 * existing frontend (which edits all four as part of the global Settings
 * save). This module does the bidirectional bridging:
 *
 *   - `mirrorAggregateIntoSettings(data)` enriches an outgoing Settings
 *     response with current contents of the four tables.
 *   - `syncAggregateFromSettings(data)` performs replace-all upserts
 *     against the four tables based on incoming Settings arrays, then
 *     strips them from the JSON so they aren't persisted twice.
 *
 * The design preserves API compatibility while moving the source of
 * truth into relational storage. Future code can talk to the tables
 * directly via dedicated CRUD endpoints without the settings round-trip.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import type { Sauna, Aroma, InfoItem, Event as EventRow } from '@prisma/client';

type AnyRecord = Record<string, unknown>;

type Tx = PrismaClient | Prisma.TransactionClient;

// ─── Mirror (table → JSON) ──────────────────────────────────────────────────

export async function mirrorAggregateIntoSettings(
  client: Tx,
  data: AnyRecord,
): Promise<AnyRecord> {
  const [saunas, aromas, infos, events] = await Promise.all([
    client.sauna.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
    client.aroma.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
    client.infoItem.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
    client.event.findMany({ orderBy: [{ order: 'asc' }, { id: 'asc' }] }),
  ]);

  return {
    ...data,
    saunas: saunas.map(saunaRowToJson),
    aromas: aromas.map(aromaRowToJson),
    infos: infos.map(infoRowToJson),
    events: events.map(eventRowToJson),
  };
}

function saunaRowToJson(row: Sauna): AnyRecord {
  const out: AnyRecord = {
    id: row.id,
    name: row.name,
    status: row.status,
    order: row.order,
    info: row.info,
  };
  if (row.imageId !== null) out.imageId = row.imageId;
  if (row.color !== null) out.color = row.color;
  if (row.description !== null) out.description = row.description;
  return out;
}

function aromaRowToJson(row: Aroma): AnyRecord {
  const out: AnyRecord = {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
  };
  if (row.color !== null) out.color = row.color;
  return out;
}

function infoRowToJson(row: InfoItem): AnyRecord {
  const out: AnyRecord = {
    id: row.id,
    title: row.title,
    text: row.text,
  };
  if (row.imageId !== null) out.imageId = row.imageId;
  if (row.imageMode !== null) out.imageMode = row.imageMode;
  return out;
}

function eventRowToJson(row: EventRow): AnyRecord {
  const out: AnyRecord = {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    startTime: row.startTime,
    assignedPreset: row.assignedPreset,
    isActive: row.isActive,
    targetDeviceIds: row.targetDeviceIds,
  };
  if (row.description !== null) out.description = row.description;
  if (row.imageId !== null) out.imageId = row.imageId;
  if (row.endDate !== null) out.endDate = row.endDate;
  if (row.endTime !== null) out.endTime = row.endTime;
  if (row.slideshowId !== null) out.slideshowId = row.slideshowId;
  return out;
}

// ─── Sync (JSON → tables) ───────────────────────────────────────────────────

export async function syncAggregateFromSettings(
  client: Tx,
  data: AnyRecord,
): Promise<{ saunas: number; aromas: number; infos: number; events: number }> {
  const saunas = Array.isArray(data.saunas) ? data.saunas : [];
  const aromas = Array.isArray(data.aromas) ? data.aromas : [];
  const infos = Array.isArray(data.infos) ? data.infos : [];
  const events = Array.isArray(data.events) ? data.events : [];

  // Replace-all upserts: every present row is upserted, every missing row
  // is deleted. Within a single transaction so a partial failure leaves
  // no orphaned rows behind.
  const knownSlideshowIds = new Set(
    (await client.slideshow.findMany({ select: { id: true } })).map((s) => s.id),
  );

  await syncSaunas(client, saunas);
  await syncAromas(client, aromas);
  await syncInfos(client, infos);
  await syncEvents(client, events, knownSlideshowIds);

  return {
    saunas: saunas.length,
    aromas: aromas.length,
    infos: infos.length,
    events: events.length,
  };
}

async function syncSaunas(client: Tx, items: unknown[]): Promise<void> {
  const presentIds: string[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isObject(raw)) continue;
    const id = stringField(raw, 'id');
    if (!id) continue;
    presentIds.push(id);

    const orderValue = numberField(raw, 'order') ?? index;
    const status = stringField(raw, 'status') ?? 'active';
    const info = isObject(raw.info) ? (raw.info as Prisma.InputJsonValue) : ({} as Prisma.InputJsonValue);

    await client.sauna.upsert({
      where: { id },
      create: {
        id,
        name: stringField(raw, 'name') ?? '',
        status,
        order: orderValue,
        imageId: stringField(raw, 'imageId') ?? null,
        color: stringField(raw, 'color') ?? null,
        description: stringField(raw, 'description') ?? null,
        info,
      },
      update: {
        name: stringField(raw, 'name') ?? '',
        status,
        order: orderValue,
        imageId: stringField(raw, 'imageId') ?? null,
        color: stringField(raw, 'color') ?? null,
        description: stringField(raw, 'description') ?? null,
        info,
      },
    });
  }
  await client.sauna.deleteMany({ where: { id: { notIn: presentIds } } });
}

async function syncAromas(client: Tx, items: unknown[]): Promise<void> {
  const presentIds: string[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isObject(raw)) continue;
    const id = stringField(raw, 'id');
    if (!id) continue;
    presentIds.push(id);

    await client.aroma.upsert({
      where: { id },
      create: {
        id,
        name: stringField(raw, 'name') ?? '',
        emoji: stringField(raw, 'emoji') ?? '',
        color: stringField(raw, 'color') ?? null,
        order: numberField(raw, 'order') ?? index,
      },
      update: {
        name: stringField(raw, 'name') ?? '',
        emoji: stringField(raw, 'emoji') ?? '',
        color: stringField(raw, 'color') ?? null,
        order: numberField(raw, 'order') ?? index,
      },
    });
  }
  await client.aroma.deleteMany({ where: { id: { notIn: presentIds } } });
}

async function syncInfos(client: Tx, items: unknown[]): Promise<void> {
  const presentIds: string[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isObject(raw)) continue;
    const id = stringField(raw, 'id');
    if (!id) continue;
    presentIds.push(id);

    await client.infoItem.upsert({
      where: { id },
      create: {
        id,
        title: stringField(raw, 'title') ?? '',
        text: stringField(raw, 'text') ?? '',
        imageId: stringField(raw, 'imageId') ?? null,
        imageMode: stringField(raw, 'imageMode') ?? null,
        order: numberField(raw, 'order') ?? index,
      },
      update: {
        title: stringField(raw, 'title') ?? '',
        text: stringField(raw, 'text') ?? '',
        imageId: stringField(raw, 'imageId') ?? null,
        imageMode: stringField(raw, 'imageMode') ?? null,
        order: numberField(raw, 'order') ?? index,
      },
    });
  }
  await client.infoItem.deleteMany({ where: { id: { notIn: presentIds } } });
}

async function syncEvents(
  client: Tx,
  items: unknown[],
  knownSlideshowIds: Set<string>,
): Promise<void> {
  const presentIds: string[] = [];
  for (const [index, raw] of items.entries()) {
    if (!isObject(raw)) continue;
    const id = stringField(raw, 'id');
    if (!id) continue;
    presentIds.push(id);

    const slideshowId = stringField(raw, 'slideshowId');
    const safeSlideshowId = slideshowId && knownSlideshowIds.has(slideshowId) ? slideshowId : null;

    const targetDeviceIds = Array.isArray(raw.targetDeviceIds)
      ? (raw.targetDeviceIds as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];

    const assignedPreset = stringField(raw, 'assignedPreset') ?? 'Evt1';

    await client.event.upsert({
      where: { id },
      create: {
        id,
        name: stringField(raw, 'name') ?? '',
        description: stringField(raw, 'description') ?? null,
        imageId: stringField(raw, 'imageId') ?? null,
        startDate: stringField(raw, 'startDate') ?? '',
        startTime: stringField(raw, 'startTime') ?? '',
        endDate: stringField(raw, 'endDate') ?? null,
        endTime: stringField(raw, 'endTime') ?? null,
        assignedPreset,
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
        targetDeviceIds,
        slideshowId: safeSlideshowId,
        order: numberField(raw, 'order') ?? index,
      },
      update: {
        name: stringField(raw, 'name') ?? '',
        description: stringField(raw, 'description') ?? null,
        imageId: stringField(raw, 'imageId') ?? null,
        startDate: stringField(raw, 'startDate') ?? '',
        startTime: stringField(raw, 'startTime') ?? '',
        endDate: stringField(raw, 'endDate') ?? null,
        endTime: stringField(raw, 'endTime') ?? null,
        assignedPreset,
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
        targetDeviceIds,
        slideshowId: safeSlideshowId,
        order: numberField(raw, 'order') ?? index,
      },
    });
  }
  await client.event.deleteMany({ where: { id: { notIn: presentIds } } });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function stripAggregateFromSettings(data: AnyRecord): AnyRecord {
  const { saunas: _s, aromas: _a, infos: _i, events: _e, ...rest } = data;
  return rest;
}

function isObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(obj: AnyRecord, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function numberField(obj: AnyRecord, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
