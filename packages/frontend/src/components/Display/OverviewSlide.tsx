import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getDayLabel } from '@/types/schedule.types';

interface OverviewSlideProps {
  schedule: Schedule;
  settings: Settings;
}

export function OverviewSlide({ schedule, settings }: OverviewSlideProps) {
  const { theme, fonts } = settings;

  // Group rows by day
  const rowsByDay = schedule.rows.reduce((acc, row) => {
    const dayKey = row.dayOffset.toString();
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(row);
    return acc;
  }, {} as Record<string, typeof schedule.rows>);

  const days = Object.keys(rowsByDay).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div
      className="w-full h-screen p-8 flex flex-col"
      style={{
        backgroundColor: theme.bg,
        color: theme.fg,
        fontSize: `${fonts.fontScale}rem`,
      }}
    >
      {/* Header */}
      <div
        className="text-center mb-8"
        style={{
          fontSize: `${fonts.h1Scale}em`,
          fontWeight: fonts.tileTimeWeight,
          color: theme.headRowFg,
        }}
      >
        <h1>Aufgussplan</h1>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-4">
          {days.map((dayOffset) => {
            const dayRows = rowsByDay[dayOffset];
            const isEven = parseInt(dayOffset) % 2 === 0;

            return (
              <div key={dayOffset} className="flex-1 flex flex-col">
                {/* Day Header */}
                <div
                  className="text-center py-4 mb-4 rounded-lg"
                  style={{
                    backgroundColor: theme.headRowBg,
                    color: theme.headRowFg,
                    fontSize: `${fonts.overviewHeadScale}em`,
                    fontWeight: 600,
                  }}
                >
                  {getDayLabel(parseInt(dayOffset))}
                </div>

                {/* Rows for this day */}
                <div className="flex-1 flex flex-col gap-3 overflow-auto">
                  {dayRows.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex flex-col gap-2">
                      {/* Sauna Name */}
                      <div
                        className="text-center py-2 rounded"
                        style={{
                          backgroundColor: isEven ? theme.zebra1 : theme.zebra2,
                          fontSize: `${fonts.overviewTitleScale}em`,
                          fontWeight: 600,
                        }}
                      >
                        {row.sauna}
                      </div>

                      {/* Cells */}
                      {row.cells.map((cell, cellIdx) => (
                        <div
                          key={cellIdx}
                          className="rounded p-3"
                          style={{
                            backgroundColor: theme.cellBg,
                            borderLeft: `4px solid ${theme.accent}`,
                          }}
                        >
                          <div
                            className="font-bold"
                            style={{
                              fontSize: `${fonts.overviewTimeScale}em`,
                              color: theme.boxFg,
                            }}
                          >
                            {cell.time}
                          </div>
                          <div
                            style={{
                              fontSize: `${fonts.overviewCellScale}em`,
                              marginTop: '0.25rem',
                            }}
                          >
                            {cell.title}
                          </div>
                          {cell.subtitle && (
                            <div
                              style={{
                                fontSize: `${fonts.overviewCellScale * 0.9}em`,
                                opacity: 0.8,
                                marginTop: '0.125rem',
                              }}
                            >
                              {cell.subtitle}
                            </div>
                          )}
                          {cell.badges && cell.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {cell.badges.map((badge, badgeIdx) => (
                                <span
                                  key={badgeIdx}
                                  className="px-2 py-1 rounded-full"
                                  style={{
                                    backgroundColor: theme.flame,
                                    color: '#FFFFFF',
                                    fontSize: `${fonts.badgeTextScale}em`,
                                  }}
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
