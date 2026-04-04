/**
 * Data migration: Extract the global slideshow from Settings into a Slideshow row,
 * and convert any existing device slideshow overrides into standalone Slideshow rows.
 *
 * Run:  npx tsx src/scripts/migrateToMultiSlideshow.ts
 */
import { prisma } from '../lib/prisma.js';

async function main() {
  console.log('=== Multi-Slideshow Migration ===\n');

  // 1. Check if a default slideshow already exists
  const existing = await prisma.slideshow.findFirst({ where: { isDefault: true } });
  if (existing) {
    console.log(`Default slideshow already exists: "${existing.name}" (${existing.id}). Skipping creation.`);
  } else {
    // Get the active settings
    const activeSettings = await prisma.settings.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    const settingsData = (activeSettings?.data ?? {}) as Record<string, unknown>;
    const slideshowConfig = settingsData.slideshow ?? {};

    const defaultSlideshow = await prisma.slideshow.create({
      data: {
        name: 'Standard',
        isDefault: true,
        config: slideshowConfig as object,
      },
    });

    console.log(`Created default slideshow: "${defaultSlideshow.name}" (${defaultSlideshow.id})`);
  }

  // 2. Migrate device overrides that have slideshow configs
  const devicesWithOverrides = await prisma.device.findMany({
    where: {
      mode: 'override',
      overrides: { isNot: null },
    },
    include: { overrides: true },
  });

  for (const device of devicesWithOverrides) {
    if (!device.overrides) continue;

    const overrideSettings = (device.overrides.settings ?? {}) as Record<string, unknown>;
    if (!overrideSettings.slideshow) {
      console.log(`  Device "${device.name}" (${device.id}): no slideshow override, skipping.`);
      continue;
    }

    // Already has a slideshowId? Skip.
    if (device.slideshowId) {
      console.log(`  Device "${device.name}" (${device.id}): already has slideshowId, skipping.`);
      continue;
    }

    // Create a new slideshow from the override
    const slideshow = await prisma.slideshow.create({
      data: {
        name: `${device.name}`,
        isDefault: false,
        config: overrideSettings.slideshow as object,
      },
    });

    // Assign the device to the new slideshow
    await prisma.device.update({
      where: { id: device.id },
      data: { slideshowId: slideshow.id },
    });

    // Strip slideshow (and audio, which was also override-only) from the DeviceOverride settings
    const { slideshow: _s, audio: _a, ...remainingSettings } = overrideSettings;
    const schedule = device.overrides.schedule;
    const hasRemainingData = Object.keys(remainingSettings).length > 0 || (schedule && Object.keys(schedule as object).length > 0);

    if (hasRemainingData) {
      await prisma.deviceOverride.update({
        where: { id: device.overrides.id },
        data: { settings: remainingSettings as object },
      });
    } else {
      await prisma.deviceOverride.delete({ where: { id: device.overrides.id } });
    }

    console.log(`  Device "${device.name}": created slideshow "${slideshow.name}" (${slideshow.id}), assigned.`);
  }

  console.log('\n=== Migration complete ===');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
