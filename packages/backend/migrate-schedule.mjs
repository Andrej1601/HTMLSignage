// Migration script to convert old schedule format to new preset-based format
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Starting schedule migration...');

    // Get old schedule
    const oldSchedule = await prisma.schedule.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!oldSchedule) {
      console.log('No schedule found, creating default...');
      const defaultSaunas = ['Vulkan', 'Nordisch', 'Bio'];
      const emptyDaySchedule = { saunas: [...defaultSaunas], rows: [] };
      const defaultSchedule = {
        version: 1,
        presets: {
          Mon: emptyDaySchedule,
          Tue: emptyDaySchedule,
          Wed: emptyDaySchedule,
          Thu: emptyDaySchedule,
          Fri: emptyDaySchedule,
          Sat: emptyDaySchedule,
          Sun: emptyDaySchedule,
          Opt: emptyDaySchedule,
          Evt1: emptyDaySchedule,
          Evt2: emptyDaySchedule,
        },
        autoPlay: false,
      };

      await prisma.schedule.create({
        data: {
          version: 1,
          data: defaultSchedule,
          isActive: true,
        },
      });
      console.log('Created default schedule');
      return;
    }

    const oldData = oldSchedule.data;

    // Check if already in new format
    if (oldData.presets) {
      console.log('Schedule already in new format');
      return;
    }

    console.log('Converting old format to new format...');

    // Convert old format to new format
    const oldRows = oldData.rows || [];

    // Group rows by dayOffset
    const rowsByDay = {};
    oldRows.forEach(row => {
      const dayKey = row.dayOffset || 0;
      if (!rowsByDay[dayKey]) {
        rowsByDay[dayKey] = [];
      }
      rowsByDay[dayKey].push(row);
    });

    // Collect all unique saunas
    const saunasSet = new Set();
    oldRows.forEach(row => {
      if (row.sauna) saunasSet.add(row.sauna);
    });
    const saunas = Array.from(saunasSet);

    // Create new format
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const newPresets = {};

    // Initialize all presets with empty schedules
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Opt', 'Evt1', 'Evt2'].forEach(key => {
      newPresets[key] = {
        saunas: [...saunas],
        rows: [],
      };
    });

    // Convert rows for each day
    Object.keys(rowsByDay).forEach(dayKey => {
      const dayOffset = parseInt(dayKey);
      const presetKey = dayMap[dayOffset] || 'Mon';
      const dayRows = rowsByDay[dayKey];

      // Group cells by time
      const timeMap = {};
      dayRows.forEach(row => {
        row.cells.forEach(cell => {
          if (!timeMap[cell.time]) {
            timeMap[cell.time] = {};
          }
          timeMap[cell.time][row.sauna] = {
            title: cell.title,
            subtitle: cell.subtitle,
            badges: cell.badges,
            duration: cell.duration,
            notes: cell.notes,
          };
        });
      });

      // Create time rows
      const timeRows = Object.keys(timeMap).map(time => {
        const entries = saunas.map(sauna => timeMap[time][sauna] || null);
        return { time, entries };
      }).sort((a, b) => {
        const [aH, aM] = a.time.split(':').map(Number);
        const [bH, bM] = b.time.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });

      newPresets[presetKey].rows = timeRows;
    });

    const newSchedule = {
      version: oldData.version + 1,
      presets: newPresets,
      autoPlay: false,
    };

    // Deactivate old schedule
    await prisma.schedule.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create new schedule
    await prisma.schedule.create({
      data: {
        version: newSchedule.version,
        data: newSchedule,
        isActive: true,
      },
    });

    console.log('Migration completed successfully!');
    console.log('New schedule version:', newSchedule.version);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
