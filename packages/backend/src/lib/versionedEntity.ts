import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

/**
 * Thrown when the client tries to save a version that is no longer current.
 * This happens when two admins edit simultaneously: the second save would
 * silently overwrite the first.  Instead we surface it so the UI can warn.
 */
export class VersionConflictError extends Error {
  constructor(
    public readonly latestVersion: number,
    public readonly clientExpectedVersion: number,
  ) {
    super(
      `Version conflict: latest is ${latestVersion}, ` +
      `but client based their edit on version ${clientExpectedVersion}.`,
    );
    this.name = 'VersionConflictError';
  }
}

interface CreateVersionedOptions {
  /**
   * The version the client last loaded before editing.
   * If provided, the save is rejected with a VersionConflictError when the DB
   * already has a newer version — i.e. someone else saved in the meantime.
   */
  expectedPreviousVersion?: number;
}

export async function createVersionedRecord(
  model: 'settings' | 'schedule',
  data: Record<string, unknown>,
  options?: CreateVersionedOptions,
): Promise<{ id: string; version: number }> {
  if (model === 'settings') {
    return createVersionedSettings(data, options);
  }
  return createVersionedSchedule(data, options);
}

async function createVersionedSettings(
  data: Record<string, unknown>,
  options?: CreateVersionedOptions,
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const latest = await tx.settings.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const latestVersion = latest?.version ?? 0;

      // Optimistic locking — only checked when the caller provides the version
      // they based their edit on.
      if (
        options?.expectedPreviousVersion !== undefined &&
        latestVersion !== options.expectedPreviousVersion
      ) {
        throw new VersionConflictError(latestVersion, options.expectedPreviousVersion);
      }

      const nextVersion = latestVersion + 1;

      const created = await tx.settings.create({
        data: {
          version: nextVersion,
          data: data as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
      });

      await tx.settings.updateMany({
        where: { id: { not: created.id }, isActive: true },
        data: { isActive: false },
      });

      return { id: created.id, version: nextVersion };
    },
    { isolationLevel: 'Serializable' },
  );

  return result;
}

async function createVersionedSchedule(
  data: Record<string, unknown>,
  options?: CreateVersionedOptions,
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const latest = await tx.schedule.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const latestVersion = latest?.version ?? 0;

      if (
        options?.expectedPreviousVersion !== undefined &&
        latestVersion !== options.expectedPreviousVersion
      ) {
        throw new VersionConflictError(latestVersion, options.expectedPreviousVersion);
      }

      const nextVersion = latestVersion + 1;

      const created = await tx.schedule.create({
        data: {
          version: nextVersion,
          data: data as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
      });

      await tx.schedule.updateMany({
        where: { id: { not: created.id }, isActive: true },
        data: { isActive: false },
      });

      return { id: created.id, version: nextVersion };
    },
    { isolationLevel: 'Serializable' },
  );

  return result;
}
