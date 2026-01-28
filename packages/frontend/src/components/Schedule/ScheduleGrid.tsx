import { useState } from 'react';
import type { Schedule, Row, Cell } from '@/types/schedule.types';
import { getDayLabel } from '@/types/schedule.types';
import { Plus, Edit } from 'lucide-react';
import clsx from 'clsx';

interface ScheduleGridProps {
  schedule: Schedule;
  onEditCell: (rowIndex: number, cellIndex: number, cell: Cell) => void;
  onAddCell: (rowIndex: number) => void;
  onAddRow: () => void;
}

export function ScheduleGrid({ schedule, onEditCell, onAddCell, onAddRow }: ScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  if (!schedule || schedule.rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-spa-text-secondary mb-4">Noch keine Aufgussplan-Einträge vorhanden</p>
        <button
          onClick={onAddRow}
          className="px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors"
        >
          Erste Zeile hinzufügen
        </button>
      </div>
    );
  }

  // Group rows by day
  const rowsByDay = schedule.rows.reduce((acc, row, rowIndex) => {
    const dayKey = row.dayOffset.toString();
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push({ row, rowIndex });
    return acc;
  }, {} as Record<string, Array<{ row: Row; rowIndex: number }>>);

  const sortedDays = Object.keys(rowsByDay).sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="space-y-8">
      {sortedDays.map((dayKey) => {
        const dayOffset = parseInt(dayKey);
        const dayRows = rowsByDay[dayKey];

        return (
          <div key={dayKey} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Day Header */}
            <div className="bg-spa-primary text-white px-6 py-3">
              <h3 className="text-lg font-semibold">{getDayLabel(dayOffset)}</h3>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-spa-bg-secondary">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-spa-text-primary w-32">
                      Sauna
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-spa-text-primary">
                      Aufgüsse
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map(({ row, rowIndex }) => (
                    <tr key={rowIndex} className="border-t border-spa-bg-secondary hover:bg-spa-bg-primary/50">
                      {/* Sauna Name */}
                      <td className="px-4 py-3 font-medium text-spa-text-primary">
                        {row.sauna}
                      </td>

                      {/* Cells */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {row.cells.map((cell, cellIndex) => {
                            const cellKey = `${rowIndex}-${cellIndex}`;
                            const isHovered = hoveredCell === cellKey;

                            return (
                              <div
                                key={cellIndex}
                                className={clsx(
                                  'relative group cursor-pointer rounded-md px-3 py-2 min-w-[120px]',
                                  'border-2 transition-all',
                                  isHovered
                                    ? 'border-spa-accent bg-spa-accent-warm/20 shadow-md'
                                    : 'border-spa-secondary/30 bg-spa-bg-primary hover:border-spa-accent/50'
                                )}
                                onClick={() => onEditCell(rowIndex, cellIndex, cell)}
                                onMouseEnter={() => setHoveredCell(cellKey)}
                                onMouseLeave={() => setHoveredCell(null)}
                              >
                                {/* Time */}
                                <div className="text-xs font-bold text-spa-primary mb-1">
                                  {cell.time}
                                </div>

                                {/* Title */}
                                <div className="text-sm font-medium text-spa-text-primary line-clamp-1">
                                  {cell.title || 'Kein Titel'}
                                </div>

                                {/* Subtitle */}
                                {cell.subtitle && (
                                  <div className="text-xs text-spa-text-secondary line-clamp-1 mt-1">
                                    {cell.subtitle}
                                  </div>
                                )}

                                {/* Badges */}
                                {cell.badges && cell.badges.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {cell.badges.map((badge, i) => (
                                      <span
                                        key={i}
                                        className="text-xs px-1.5 py-0.5 bg-spa-secondary/20 text-spa-secondary-dark rounded"
                                      >
                                        {badge}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Edit Icon (visible on hover) */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Edit className="w-3 h-3 text-spa-primary" />
                                </div>
                              </div>
                            );
                          })}

                          {/* Add Cell Button */}
                          <button
                            onClick={() => onAddCell(rowIndex)}
                            className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-spa-secondary/30 rounded-md text-spa-secondary hover:border-spa-secondary hover:bg-spa-secondary/5 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Hinzufügen</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Add Row Button */}
      <button
        onClick={onAddRow}
        className="w-full px-4 py-3 border-2 border-dashed border-spa-primary/30 rounded-lg text-spa-primary hover:border-spa-primary hover:bg-spa-primary/5 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Neue Zeile hinzufügen</span>
      </button>
    </div>
  );
}
