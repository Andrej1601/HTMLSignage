import { useState } from 'react';
import type { DaySchedule } from '@/types/schedule.types';
import { Plus, Trash2, Flame } from 'lucide-react';
import { Button } from '@/components/Button';
import clsx from 'clsx';

interface ScheduleGridProps {
  daySchedule: DaySchedule;
  onEditCell: (timeRowIndex: number, saunaIndex: number) => void;
  onEditTime: (timeRowIndex: number) => void;
  onAddTimeRow: () => void;
  onDeleteTimeRow: (timeRowIndex: number) => void;
}

export function ScheduleGrid({
  daySchedule,
  onEditCell,
  onEditTime,
  onAddTimeRow,
  onDeleteTimeRow,
}: ScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  if (daySchedule.rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-spa-text-secondary mb-4">Noch keine Aufgüsse für diesen Tag</p>
        <Button icon={Plus} onClick={onAddTimeRow}>
          Ersten Aufguss hinzufügen
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Grid Table — horizontal + vertical scroll with sticky header & time column */}
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full border-collapse">
          <thead className="bg-spa-primary text-white sticky top-0 z-20">
            <tr>
              <th className="px-4 py-3 text-left font-semibold w-24 sticky left-0 z-30 bg-spa-primary">
                Zeit
              </th>
              {daySchedule.saunas.map((sauna, idx) => (
                <th key={idx} className="px-4 py-3 text-left font-semibold min-w-[200px] whitespace-nowrap">
                  {sauna}
                </th>
              ))}
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {daySchedule.rows.map((timeRow, timeRowIndex) => (
              <tr key={timeRowIndex} className="border-t border-spa-bg-secondary group hover:bg-spa-bg-primary/50">
                {/* Time Column — sticky left with proper bg */}
                <td className="px-4 py-3 sticky left-0 z-10 bg-white group-hover:bg-spa-bg-primary/50 transition-colors">
                  <button
                    onClick={() => onEditTime(timeRowIndex)}
                    className="font-bold text-spa-primary hover:text-spa-primary-dark hover:underline cursor-pointer min-h-[44px] min-w-[44px] flex items-center"
                    title="Zeit bearbeiten"
                  >
                    {timeRow.time}
                  </button>
                </td>

                {/* Sauna Cells */}
                {timeRow.entries.map((entry, saunaIndex) => {
                  const cellKey = `${timeRowIndex}-${saunaIndex}`;
                  const isHovered = hoveredCell === cellKey;

                  return (
                    <td key={saunaIndex} className="px-4 py-3">
                      {entry ? (
                        <div
                          className={clsx(
                            'relative cursor-pointer rounded-lg px-3 py-3 min-h-[80px]',
                            'border-2 transition-all',
                            isHovered
                              ? 'border-spa-accent bg-spa-accent-warm/20 shadow-md'
                              : 'border-spa-secondary/30 bg-spa-bg-primary hover:border-spa-accent/50'
                          )}
                          onClick={() => onEditCell(timeRowIndex, saunaIndex)}
                          onMouseEnter={() => setHoveredCell(cellKey)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {/* Title */}
                          <div className="font-semibold text-spa-text-primary mb-1">
                            {entry.title || 'Kein Titel'}
                          </div>

                          {/* Subtitle */}
                          {entry.subtitle && (
                            <div className="text-sm text-spa-text-secondary mb-2">
                              {entry.subtitle}
                            </div>
                          )}

                          {/* Flames */}
                          {entry.flames && (
                            <div className="flex gap-0.5 mb-2">
                              {Array.from({ length: entry.flames }).map((_, i) => (
                                <Flame key={i} className="w-4 h-4 text-spa-warning fill-spa-warning" />
                              ))}
                            </div>
                          )}

                          {/* Badges */}
                          {entry.badges && entry.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {entry.badges.map((badge, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-spa-secondary/20 text-spa-secondary-dark rounded-full"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Duration */}
                          {entry.duration && (
                            <div className="text-xs text-spa-text-secondary mt-2">
                              {entry.duration} Min.
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => onEditCell(timeRowIndex, saunaIndex)}
                          className="w-full min-h-[80px] border-2 border-dashed border-spa-secondary/20 rounded-lg text-spa-text-secondary hover:border-spa-secondary hover:bg-spa-secondary/5 transition-all flex items-center justify-center"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  );
                })}

                {/* Delete Row Button */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDeleteTimeRow(timeRowIndex)}
                    className="p-2 text-spa-error hover:bg-spa-error-light rounded-md transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Zeit löschen"
                    aria-label="Zeitreihe löschen"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Time Row Button */}
      <div className="border-t border-spa-bg-secondary p-4">
        <button
          onClick={onAddTimeRow}
          className="w-full px-4 py-3 border-2 border-dashed border-spa-primary/30 rounded-lg text-spa-primary hover:border-spa-primary hover:bg-spa-primary/5 transition-all flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">Neue Zeit hinzufügen</span>
        </button>
      </div>
    </div>
  );
}
