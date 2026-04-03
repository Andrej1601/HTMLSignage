import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export async function createVersionedRecord(
  model: 'settings' | 'schedule',
  data: Record<string, unknown>,
): Promise<{ id: string; version: number }> {
  if (model === 'settings') {
    return createVersionedSettings(data);
  }
  return createVersionedSchedule(data);
}

async function createVersionedSettings(data: Record<string, unknown>) {
  const result = await prisma.$transaction(async () => {
    const latest = await prisma.settings.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await prisma.settings.create({
      data: {
        version: nextVersion,
        data: data as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    await prisma.settings.updateMany({
      where: { id: { not: created.id }, isActive: true },
      data: { isActive: false },
    });

    return { id: created.id, version: nextVersion };
  });

  return result;
}

async function createVersionedSchedule(data: Record<string, unknown>) {
  const result = await prisma.$transaction(async () => {
    const latest = await prisma.schedule.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await prisma.schedule.create({
      data: {
        version: nextVersion,
        data: data as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    await prisma.schedule.updateMany({
      where: { id: { not: created.id }, isActive: true },
      data: { isActive: false },
    });

    return { id: created.id, version: nextVersion };
  });

  return result;
}
