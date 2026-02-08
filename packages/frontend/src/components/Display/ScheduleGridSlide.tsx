import { useEffect, useRef } from 'react';
import type { Schedule, PresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getTodayPresetKey, PRESET_LABELS } from '@/types/schedule.types';
import { getDefaultSettings } from '@/types/settings.types';
import { Flame, Clock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface ScheduleGridSlideProps {
  schedule: Schedule;
  settings: Settings;
}

// StatusBadge is now imported from ./StatusBadge.tsx

export function ScheduleGridSlide({ schedule, settings }: ScheduleGridSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const scrollRef = useRef<HTMLTableSectionElement>(null);

  // Determine which preset to show
  const activePresetKey: PresetKey = schedule.autoPlay
    ? getTodayPresetKey()
    : (schedule.activePreset || getTodayPresetKey());

  const daySchedule = schedule.presets?.[activePresetKey];

  // Debug logging
  console.log('[ScheduleGridSlide] Debug:', {
    activePresetKey,
    hasDaySchedule: !!daySchedule,
    saunasCount: daySchedule?.saunas?.length,
    rowsCount: daySchedule?.rows?.length,
    presetKeys: Object.keys(schedule.presets || {}),
  });

  // Debug: Show actual row data
  console.log('[ScheduleGridSlide] Rows Detail:',
    daySchedule?.rows?.map((row, idx) => ({
      index: idx,
      time: row.time,
      entriesCount: row.entries?.length || 0,
      entries: row.entries?.map((entry, entryIdx) => ({
        entryIndex: entryIdx,
        hasTitle: !!entry?.title,
        title: entry?.title || 'LEER',
        flames: entry?.flames || 0,
        badges: entry?.badges || [],
      })),
    }))
  );

  if (!daySchedule || !daySchedule.rows || daySchedule.rows.length === 0) {
    return (
      <div
        className="w-full h-full flex items-center justify-center p-6"
        style={{
          backgroundColor: theme.dashboardBg || theme.bg,
          color: theme.textMain || theme.fg,
        }}
      >
        <div className="text-center">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-black mb-2">Kein Aufgussplan</h2>
          <p className="opacity-70">Noch keine Aufgüsse für {PRESET_LABELS[activePresetKey]} eingeplant</p>
        </div>
      </div>
    );
  }

  // Get current time to highlight active/next sessions
  const now = new Date();
  const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

  // Find active and next session
  let activeSession: any = null;
  let nextSession: any = null;

  daySchedule.rows.forEach((row) => {
    const [hours, minutes] = row.time.split(':').map(Number);
    const rowTimeMinutes = hours * 60 + minutes;
    const sessionDuration = 60; // Assume 60 minutes per session

    if (
      currentTimeMinutes >= rowTimeMinutes &&
      currentTimeMinutes < rowTimeMinutes + sessionDuration
    ) {
      (row.entries || []).forEach((entry, idx) => {
        if (entry?.title) {
          activeSession = { row: row.time, col: idx, text: entry.title, subtitle: entry.subtitle };
        }
      });
    } else if (rowTimeMinutes > currentTimeMinutes && !nextSession) {
      (row.entries || []).forEach((entry, idx) => {
        if (entry?.title) {
          nextSession = { row: row.time, col: idx, text: entry.title, subtitle: entry.subtitle };
        }
      });
    }
  });

  // Auto-scroll effect for large schedules
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !daySchedule || daySchedule.rows.length <= 8) return; // Only scroll if more than 8 rows

    let scrollPos = 0;
    const scrollMax = el.scrollHeight - el.clientHeight;

    if (scrollMax <= 0) return;

    const scrollInterval = setInterval(() => {
      scrollPos += 0.3; // Slower scroll speed for readability
      if (scrollPos >= scrollMax + 100) scrollPos = -100; // Add pause at end
      el.scrollTop = scrollPos;
    }, 50);

    return () => clearInterval(scrollInterval);
  }, [daySchedule?.rows.length]);

  return (
    <div
      className="w-full h-full flex flex-col animate-in fade-in duration-700 p-8"
      style={{
        backgroundColor: theme.dashboardBg || theme.bg,
        color: theme.textMain || theme.fg,
      }}
    >
      {/* Modern Header */}
      <header className="mb-10 flex justify-between items-center z-20 w-full">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div
            className="w-14 h-14 border rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{
              backgroundColor: theme.cardBg || '#FFFFFF',
              borderColor: theme.cardBorder || theme.gridTable,
            }}
          >
            <Clock className="w-7 h-7" style={{ color: theme.accentGreen || theme.accentGold || theme.accent }} />
          </div>
          <div className="min-w-0">
            <p
              className="font-black uppercase tracking-[0.4em] text-[9px] mb-1 opacity-90"
              style={{ color: theme.accentGreen || theme.accentGold }}
            >
              Aufgussplan
            </p>
            <h1
              className="text-3xl font-black uppercase tracking-tighter leading-none whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: theme.textMain || theme.fg }}
            >
              Heutiges <span style={{ color: theme.accentGold || theme.accent }}>Programm</span>
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div
          className="h-full rounded-[2.5rem] border shadow-xl flex flex-col backdrop-blur-sm"
          style={{
            backgroundColor: `${theme.cardBg || theme.cellBg}60`,
            borderColor: theme.cardBorder || theme.gridTable,
          }}
        >
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-10">
              <tr
                className="border-b h-16"
                style={{
                  backgroundColor: theme.cardBg || theme.headRowBg,
                  borderColor: theme.cardBorder || theme.gridTable,
                }}
              >
                <th
                  className="p-4 text-center w-20"
                  style={{
                    fontSize: '9px',
                    fontWeight: 900,
                    color: theme.textMuted || theme.headRowFg,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                  }}
                >
                  Zeit
                </th>
                {daySchedule.saunas.map((sauna, idx) => {
                  // Assign color based on index (cycling through accent colors)
                  const colors = [
                    theme.accentGold || '#A68A64',
                    theme.accentGreen || '#8F9779',
                    '#F59E0B',
                    '#10B981',
                    '#c5a059',
                    '#8B6F47',
                  ];
                  const saunaColor = colors[idx % colors.length];

                  return (
                    <th key={idx} className="p-4 relative">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-1 h-6 rounded-full shrink-0"
                          style={{ backgroundColor: saunaColor }}
                        />
                        <div
                          style={{
                            fontSize: '10px',
                            fontWeight: 900,
                            color: theme.textMain || theme.headRowFg,
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                          }}
                          className="truncate"
                        >
                          {sauna}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <tbody
                ref={scrollRef}
                className="divide-y block overflow-auto scrollbar-hide"
                style={{
                  borderColor: theme.cardBorder || theme.gridTable,
                  height: '100%',
                }}
              >
                {daySchedule.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="group table w-full table-fixed">
                  <td
                    className="p-3 font-mono font-bold text-xl text-center border-r leading-none w-20"
                    style={{
                      color: theme.accentGold || theme.accent,
                      borderColor: theme.cardBorder || theme.gridTable,
                    }}
                  >
                    {row.time}
                  </td>
                  {(row.entries || []).map((entry, entryIdx) => {
                    const isActive =
                      activeSession?.row === row.time &&
                      activeSession?.col === entryIdx &&
                      activeSession?.text === entry?.title;
                    const isNext =
                      nextSession?.row === row.time &&
                      nextSession?.col === entryIdx &&
                      nextSession?.text === entry?.title;

                    // Parse flames to number
                    const flames = typeof entry?.flames === 'number'
                      ? entry.flames
                      : parseInt(String(entry?.flames || '1'), 10) || 1;

                    return (
                      <td key={entryIdx} className="p-2 relative h-full">
                        {entry?.title ? (
                          <div
                            className="p-2.5 rounded-2xl border transition-all duration-500 h-full flex flex-col justify-center backdrop-blur-sm shadow-sm"
                            style={{
                              backgroundColor: isActive
                                ? `${theme.statusLive || '#10B981'}10`
                                : isNext
                                ? `${theme.statusNext || theme.accentGold}10`
                                : `${theme.cardBg || '#FFFFFF'}40`,
                              borderColor: isActive
                                ? `${theme.statusLive || '#10B981'}30`
                                : isNext
                                ? `${theme.statusNext || theme.accentGold}30`
                                : `${theme.cardBorder || theme.gridTable}`,
                              boxShadow: isActive ? `0 0 0 1px ${theme.statusLive || '#10B981'}20` : undefined,
                            }}
                          >
                            <div
                              className="text-[11px] font-black uppercase leading-none truncate"
                              style={{ color: theme.textMain || theme.fg }}
                            >
                              {entry.title}
                            </div>
                            <div className="flex justify-between items-center mt-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3].map((i) => (
                                  <Flame
                                    key={i}
                                    size={11}
                                    className={
                                      i <= flames
                                        ? 'fill-current'
                                        : ''
                                    }
                                    style={{
                                      color:
                                        i <= flames
                                          ? theme.accentGold || theme.flame
                                          : theme.cardBorder || theme.gridTable,
                                    }}
                                  />
                                ))}
                              </div>
                              <StatusBadge status={isActive ? 'ongoing' : isNext ? 'next' : null} theme={theme} size="sm" />
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
