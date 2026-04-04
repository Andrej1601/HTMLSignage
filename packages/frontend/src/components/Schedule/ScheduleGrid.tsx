import { useMemo, useState } from 'react';
import type { DaySchedule, Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import { resolveAromaForBadge, getAromaDisplayColor } from '@/types/settings.types';
import { detectConflicts, getConflictsForCell } from '@/utils/scheduleConflicts';
import { Plus, Trash2, Flame, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/Button';
import clsx from 'clsx';

interface ScheduleGridProps {
  daySchedule: DaySchedule;
  aromas?: Aroma[];
  saunaColors?: Record<string, string>; // sauna name → hex color
  onEditCell: (timeRowIndex: number, saunaIndex: number) => void;
  onEditTime: (timeRowIndex: number) => void;
  onAddTimeRow: () => void;
  onDeleteTimeRow: (timeRowIndex: number) => void;
}

function EntryCard({
  entry,
  aromas,
  isHovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  entry: Entry;
  aromas: Aroma[];
  isHovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className={clsx(
        'relative cursor-pointer rounded-xl px-3.5 py-3 min-h-[72px]',
        'border transition-all',
        isHovered
          ? 'border-spa-accent bg-spa-accent-warm/15 shadow-md ring-1 ring-spa-accent/30'
          : 'border-spa-bg-secondary bg-white hover:border-spa-accent/40 hover:shadow-xs'
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Row 1: Title + Duration */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-spa-text-primary leading-tight">
          {entry.title || 'Kein Titel'}
        </h4>
        {entry.duration && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-spa-text-secondary bg-spa-bg-primary rounded-md px-1.5 py-0.5">
            <Clock className="w-3 h-3" />
            {entry.duration}'
          </span>
        )}
      </div>

      {/* Row 2: Subtitle */}
      {entry.subtitle && (
        <p className="text-sm text-spa-text-secondary mt-0.5 leading-snug">
          {entry.subtitle}
        </p>
      )}

      {/* Row 3: Flames + Badges inline */}
      {(entry.flames || (entry.badges && entry.badges.length > 0)) && (
        <div className="flex items-center flex-wrap gap-1.5 mt-2">
          {/* Flames */}
          {entry.flames && (
            <span className="inline-flex items-center gap-px mr-1">
              {Array.from({ length: entry.flames }).map((_, i) => (
                <Flame key={i} className="w-3.5 h-3.5 text-spa-warning fill-spa-warning" />
              ))}
            </span>
          )}

          {/* Aroma Badges */}
          {entry.badges?.map((badge, i) => {
            const resolved = resolveAromaForBadge(badge, aromas);
            const dc = getAromaDisplayColor(resolved.color);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] font-semibold pl-1.5 pr-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: dc.bg,
                  color: dc.text,
                  borderColor: dc.border,
                }}
              >
                {resolved.emoji && <span className="text-xs">{resolved.emoji}</span>}
                {resolved.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ScheduleGrid({
  daySchedule,
  aromas = [],
  saunaColors = {},
  onEditCell,
  onEditTime,
  onAddTimeRow,
  onDeleteTimeRow,
}: ScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const conflicts = useMemo(() => detectConflicts(daySchedule), [daySchedule]);

  if (daySchedule.rows.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-spa-bg-primary mb-4">
          <Plus className="w-7 h-7 text-spa-text-secondary" />
        </div>
        <p className="text-spa-text-secondary mb-4">Noch keine Aufgüsse für diesen Tag</p>
        <Button icon={Plus} onClick={onAddTimeRow}>
          Ersten Aufguss hinzufügen
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      {/* Scrollable grid */}
      <div className="overflow-auto max-h-[72vh]">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-spa-primary text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-24 sticky left-0 z-30 bg-spa-primary">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 opacity-70" />
                  Zeit
                </span>
              </th>
              {daySchedule.saunas.map((sauna, idx) => {
                const color = saunaColors[sauna];
                return (
                  <th key={idx} className="px-4 py-3 text-left min-w-[220px] whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span className="font-semibold text-sm">{sauna}</span>
                    </div>
                  </th>
                );
              })}
              <th className="px-2 py-3 w-12"></th>
            </tr>
          </thead>

          <tbody>
            {daySchedule.rows.map((timeRow, timeRowIndex) => (
              <tr
                key={timeRowIndex}
                className={clsx(
                  'border-t border-spa-bg-secondary/80 group',
                  timeRowIndex % 2 === 0 ? 'bg-white' : 'bg-spa-bg-primary/30'
                )}
              >
                {/* Time Column */}
                <td
                  className={clsx(
                    'px-4 py-3 sticky left-0 z-10 transition-colors',
                    timeRowIndex % 2 === 0 ? 'bg-white' : 'bg-spa-bg-primary/30',
                    'group-hover:bg-spa-primary/5'
                  )}
                >
                  <button
                    onClick={() => onEditTime(timeRowIndex)}
                    className="font-mono text-lg font-bold text-spa-primary hover:text-spa-primary-dark cursor-pointer min-h-[44px] min-w-[44px] flex items-center transition-colors"
                    title="Zeit bearbeiten"
                  >
                    {timeRow.time}
                  </button>
                </td>

                {/* Sauna Cells */}
                {timeRow.entries.map((entry, saunaIndex) => {
                  const cellKey = `${timeRowIndex}-${saunaIndex}`;
                  const isHovered = hoveredCell === cellKey;
                  const cellConflicts = getConflictsForCell(conflicts, timeRowIndex, saunaIndex);

                  return (
                    <td key={saunaIndex} className="px-3 py-2.5">
                      {entry ? (
                        <div className="relative">
                          {cellConflicts.length > 0 && (
                            <div
                              className="absolute -top-1 -right-1 z-10 p-0.5 rounded-full bg-spa-warning-light border border-spa-warning"
                              title={cellConflicts.map(c => c.message).join('\n')}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-spa-warning-dark" />
                            </div>
                          )}
                          <EntryCard
                            entry={entry}
                            aromas={aromas}
                            isHovered={isHovered}
                            onClick={() => onEditCell(timeRowIndex, saunaIndex)}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => onEditCell(timeRowIndex, saunaIndex)}
                          className="w-full min-h-[56px] border border-dashed border-spa-bg-secondary rounded-xl text-spa-text-secondary/40 hover:border-spa-secondary/50 hover:text-spa-text-secondary/70 hover:bg-spa-bg-primary/50 transition-all flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  );
                })}

                {/* Delete Row Button */}
                <td className="px-2 py-3">
                  <button
                    onClick={() => onDeleteTimeRow(timeRowIndex)}
                    className="p-2 text-spa-text-secondary/30 hover:text-spa-error hover:bg-spa-error-light rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                    title="Zeitreihe löschen"
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
          className="w-full px-4 py-3 border border-dashed border-spa-primary/25 rounded-xl text-spa-primary hover:border-spa-primary/60 hover:bg-spa-primary/5 transition-all flex items-center justify-center gap-2 min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium text-sm">Neue Zeit hinzufügen</span>
        </button>
      </div>
    </div>
  );
}
