import type { Schedule, PresetKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { getTodayPresetKey, PRESET_LABELS } from '@/types/schedule.types';
import { getDefaultSettings } from '@/types/settings.types';
import { Flame } from 'lucide-react';

interface OverviewSlideProps {
  schedule: Schedule;
  settings: Settings;
}

export function OverviewSlide({ schedule, settings }: OverviewSlideProps) {
  const defaults = getDefaultSettings();
  const theme = settings.theme || defaults.theme!;
  const fonts = settings.fonts || defaults.fonts!;

  // Determine which preset to show
  const activePresetKey: PresetKey = schedule.autoPlay
    ? getTodayPresetKey()
    : (schedule.activePreset || getTodayPresetKey());

  const daySchedule = schedule.presets[activePresetKey];

  if (!daySchedule || daySchedule.rows.length === 0) {
    return (
      <div
        className="w-full h-screen flex items-center justify-center"
        style={{
          backgroundColor: theme.bg,
          color: theme.fg,
        }}
      >
        <div className="text-center">
          <h2
            style={{
              fontSize: `${fonts.h1Scale}em`,
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            Kein Aufgussplan für {PRESET_LABELS[activePresetKey]}
          </h2>
          <p style={{ fontSize: `${fonts.fontScale}rem`, opacity: 0.7 }}>
            Noch keine Aufgüsse eingeplant
          </p>
        </div>
      </div>
    );
  }

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
        className="text-center mb-6"
        style={{
          fontSize: `${fonts.h1Scale}em`,
          fontWeight: fonts.tileTimeWeight,
          color: theme.headRowFg,
        }}
      >
        <h1>Aufgussplan - {PRESET_LABELS[activePresetKey]}</h1>
      </div>

      {/* Schedule Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="py-4 px-4 text-left sticky top-0"
                style={{
                  backgroundColor: theme.headRowBg,
                  color: theme.headRowFg,
                  fontSize: `${fonts.overviewHeadScale}em`,
                  fontWeight: 600,
                  minWidth: '100px',
                }}
              >
                Zeit
              </th>
              {daySchedule.saunas.map((sauna, idx) => (
                <th
                  key={idx}
                  className="py-4 px-4 text-left sticky top-0"
                  style={{
                    backgroundColor: theme.headRowBg,
                    color: theme.headRowFg,
                    fontSize: `${fonts.overviewHeadScale}em`,
                    fontWeight: 600,
                    minWidth: '250px',
                  }}
                >
                  {sauna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daySchedule.rows.map((timeRow, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              return (
                <tr key={rowIdx}>
                  {/* Time Column */}
                  <td
                    className="py-3 px-4 align-top"
                    style={{
                      backgroundColor: isEven ? theme.zebra1 : theme.zebra2,
                      fontSize: `${fonts.overviewTimeScale}em`,
                      fontWeight: fonts.tileTimeWeight,
                      color: theme.boxFg,
                    }}
                  >
                    {timeRow.time}
                  </td>

                  {/* Entry Cells */}
                  {timeRow.entries.map((entry, entryIdx) => (
                    <td
                      key={entryIdx}
                      className="py-3 px-4 align-top"
                      style={{
                        backgroundColor: isEven ? theme.zebra1 : theme.zebra2,
                      }}
                    >
                      {entry ? (
                        <div
                          className="rounded-lg p-3"
                          style={{
                            backgroundColor: theme.cellBg,
                            borderLeft: `4px solid ${theme.accent}`,
                          }}
                        >
                          {/* Title */}
                          <div
                            className="font-bold"
                            style={{
                              fontSize: `${fonts.overviewCellScale}em`,
                              color: theme.fg,
                            }}
                          >
                            {entry.title}
                          </div>

                          {/* Subtitle */}
                          {entry.subtitle && (
                            <div
                              style={{
                                fontSize: `${(fonts.overviewCellScale || 1) * 0.9}em`,
                                opacity: 0.8,
                                marginTop: '0.25rem',
                              }}
                            >
                              {entry.subtitle}
                            </div>
                          )}

                          {/* Flames */}
                          {entry.flames && (
                            <div className="flex gap-1 mt-2">
                              {Array.from({ length: entry.flames }).map((_, i) => (
                                <Flame
                                  key={i}
                                  className="w-5 h-5"
                                  style={{ color: theme.flame }}
                                  fill={theme.flame}
                                />
                              ))}
                            </div>
                          )}

                          {/* Badges */}
                          {entry.badges && entry.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.badges.map((badge, badgeIdx) => (
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

                          {/* Duration */}
                          {entry.duration && (
                            <div
                              className="mt-2"
                              style={{
                                fontSize: `${(fonts.overviewCellScale || 1) * 0.8}em`,
                                opacity: 0.7,
                              }}
                            >
                              {entry.duration} Min.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ opacity: 0.3, fontSize: '0.9em' }}>—</div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
