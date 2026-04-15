import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import type { DaySchedule, Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import { resolveAromaForBadge, getAromaDisplayColor } from '@/types/settings.types';
import { detectConflicts, getConflictsForCell } from '@/utils/scheduleConflicts';
import { Plus, Trash2, Flame, Clock, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/Button';
import clsx from 'clsx';

interface ScheduleGridProps {
  daySchedule: DaySchedule;
  aromas?: Aroma[];
  saunaColors?: Record<string, string>;
  saunaObjects?: Sauna[];
  onEditCell: (timeRowIndex: number, saunaIndex: number) => void;
  onEditTime: (timeRowIndex: number) => void;
  onAddTimeRow: () => void;
  onDeleteTimeRow: (timeRowIndex: number) => void;
}

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Index of the row currently "active" = last row whose time ≤ now */
function getCurrentRowIndex(rows: DaySchedule['rows'], nowMinutes: number): number {
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (parseTimeMinutes(rows[i].time) <= nowMinutes) idx = i;
    else break;
  }
  return idx;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FlameIcons({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-px shrink-0">
      {Array.from({ length: count }).map((_, i) => (
        <Flame key={i} className="w-3.5 h-3.5 text-spa-warning fill-spa-warning" />
      ))}
    </span>
  );
}

/**
 * Pure display card — interaction (click, hover) is handled at the <td> level
 * via data-attributes so this component can be wrapped in React.memo without
 * constantly receiving new callback props.
 */
const EntryCard = memo(function EntryCard({
  entry, aromas, isHovered, hasConflict,
}: {
  entry: Entry;
  aromas: Aroma[];
  isHovered: boolean;
  hasConflict: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative rounded-xl px-3.5 py-3 h-[88px] transition-all border group/card overflow-hidden pointer-events-none',
        hasConflict && 'border-spa-warning/50 bg-spa-warning-light/30',
        !hasConflict && isHovered  && 'border-spa-accent bg-spa-accent-warm/15 shadow-md ring-1 ring-spa-accent/30',
        !hasConflict && !isHovered && 'border-spa-bg-secondary bg-spa-surface',
      )}
    >
      {/* Pencil hover overlay */}
      <Pencil className="absolute top-2.5 right-2.5 w-3 h-3 opacity-0 group-hover/card:opacity-30 transition-opacity text-spa-text-secondary pointer-events-none" />

      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-spa-text-primary leading-tight min-w-0 truncate">
          {entry.title || 'Kein Titel'}
        </h4>
        {entry.flames && <FlameIcons count={entry.flames} />}
      </div>

      {/* Subtitle */}
      {entry.subtitle && (
        <p className="text-xs text-spa-text-secondary mt-0.5 leading-snug line-clamp-1">
          {entry.subtitle}
        </p>
      )}

      {/* Aroma badges */}
      {entry.badges && entry.badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {entry.badges.map((badge, i) => {
            const resolved = resolveAromaForBadge(badge, aromas);
            const dc = getAromaDisplayColor(resolved.color);
            return (
              <span
                key={i}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold pl-1 pr-1.5 py-0.5 rounded-full border"
                style={{ backgroundColor: dc.bg, color: dc.text, borderColor: dc.border }}
              >
                {resolved.emoji && <span className="text-[10px]">{resolved.emoji}</span>}
                {resolved.name}
              </span>
            );
          })}
        </div>
      )}

      {/* Duration */}
      {entry.duration && (
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="w-3 h-3 text-spa-text-secondary/50" />
          <span className="text-[11px] text-spa-text-secondary">{entry.duration} Min</span>
        </div>
      )}

      {/* Conflict indicator */}
      {hasConflict && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <AlertTriangle className="w-4 h-4 text-spa-warning-dark drop-shadow-sm" />
        </div>
      )}
    </div>
  );
});

// ── Main Grid ──────────────────────────────────────────────────────────────────

export function ScheduleGrid({
  daySchedule,
  aromas = [],
  saunaColors = {},
  saunaObjects = [],
  onEditCell,
  onEditTime,
  onAddTimeRow,
  onDeleteTimeRow,
}: ScheduleGridProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const conflicts     = useMemo(() => detectConflicts(daySchedule), [daySchedule]);
  const currentRowIdx = useMemo(() => getCurrentRowIndex(daySchedule.rows, nowMinutes), [daySchedule.rows, nowMinutes]);

  const saunaByName = useMemo(() => {
    const map: Record<string, Sauna> = {};
    saunaObjects.forEach((s) => { map[s.name] = s; });
    return map;
  }, [saunaObjects]);

  // ── Stable event handlers via data-attributes ────────────────────────────────
  // A single handler per interaction type; no new functions created per row/cell.

  const handleTimeClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const idx = Number((e.currentTarget as HTMLElement).dataset.rowIdx);
    if (!isNaN(idx)) onEditTime(idx);
  }, [onEditTime]);

  const handleCellClick = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const row   = Number((e.currentTarget as HTMLElement).dataset.rowIdx);
    const sauna = Number((e.currentTarget as HTMLElement).dataset.saunaIdx);
    if (!isNaN(row) && !isNaN(sauna)) onEditCell(row, sauna);
  }, [onEditCell]);

  const handleCellMouseEnter = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const key = (e.currentTarget as HTMLElement).dataset.cellKey ?? null;
    setHoveredCell(key);
  }, []);

  const handleCellMouseLeave = useCallback(() => setHoveredCell(null), []);

  const handleDeleteClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const idx = Number((e.currentTarget as HTMLElement).dataset.rowIdx);
    if (!isNaN(idx)) onDeleteTimeRow(idx);
  }, [onDeleteTimeRow]);

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
      <div className="overflow-auto max-h-[72vh]">
        <table className="w-full border-collapse">
          {/* Sticky header */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-spa-header-bg text-white">
              <th className="px-4 py-3 text-left w-24 sticky left-0 z-30 bg-spa-header-bg">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">
                  <Clock className="w-3.5 h-3.5" />
                  Zeit
                </span>
              </th>

              {daySchedule.saunas.map((saunaName, idx) => {
                const color       = saunaColors[saunaName];
                const sauna       = saunaByName[saunaName];
                const statusColor = sauna ? SAUNA_STATUS_COLORS[sauna.status] : '#10b981';
                const statusLabel = sauna ? SAUNA_STATUS_LABELS[sauna.status] : null;
                const temperature = sauna?.info?.temperature;

                return (
                  <th key={idx} className="px-4 py-3 text-left min-w-[220px]">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white/20"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        <span className="text-sm font-bold text-white tracking-wide">{saunaName}</span>
                      </div>
                      {(statusLabel || temperature) && (
                        <div className="flex items-center gap-2 pl-0.5">
                          {temperature && (
                            <span className="text-[11px] font-semibold text-white/80">{temperature}°C</span>
                          )}
                          {statusLabel && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: 'rgba(255,255,255,0.55)' }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: statusColor }}
                              />
                              {statusLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}

              <th className="px-2 py-3 w-12" />
            </tr>
          </thead>

          <tbody>
            {daySchedule.rows.map((timeRow, timeRowIndex) => {
              const isCurrentRow = timeRowIndex === currentRowIdx;

              return (
                <tr
                  key={timeRowIndex}
                  className={clsx(
                    'border-t group',
                    isCurrentRow
                      ? 'border-t-2 border-t-spa-success bg-spa-success-light/60'
                      : 'border-spa-bg-secondary/80',
                    !isCurrentRow && (timeRowIndex % 2 === 0 ? 'bg-spa-surface' : 'bg-spa-bg-primary/20'),
                  )}
                >
                  {/* Time cell */}
                  <td
                    className={clsx(
                      'px-4 py-3 sticky left-0 z-10 transition-colors',
                      isCurrentRow
                        ? 'bg-spa-success-light/60'
                        : timeRowIndex % 2 === 0 ? 'bg-spa-surface' : 'bg-spa-bg-primary/20',
                      'group-hover:bg-spa-primary/5',
                    )}
                  >
                    <button
                      data-row-idx={timeRowIndex}
                      onClick={handleTimeClick}
                      className={clsx(
                        'group/time flex items-center gap-1.5 font-mono text-lg font-bold transition-colors min-h-[44px] min-w-[52px]',
                        isCurrentRow ? 'text-spa-success hover:text-spa-success-dark' : 'text-spa-primary hover:text-spa-primary-dark',
                      )}
                      title="Zeit bearbeiten"
                    >
                      {timeRow.time}
                      {isCurrentRow && (
                        <span className="relative flex h-2 w-2 ml-0.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spa-success opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-spa-success" />
                        </span>
                      )}
                      {!isCurrentRow && (
                        <Pencil className="w-3 h-3 opacity-0 group-hover/time:opacity-50 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Entry cells — click/hover handled here to avoid per-cell callbacks */}
                  {timeRow.entries.map((entry, saunaIndex) => {
                    const cellKey       = `${timeRowIndex}-${saunaIndex}`;
                    const isHovered     = hoveredCell === cellKey;
                    const cellConflicts = getConflictsForCell(conflicts, timeRowIndex, saunaIndex);

                    return (
                      <td
                        key={saunaIndex}
                        className="px-3 py-2.5 cursor-pointer"
                        data-row-idx={timeRowIndex}
                        data-sauna-idx={saunaIndex}
                        data-cell-key={cellKey}
                        onClick={handleCellClick}
                        onMouseEnter={handleCellMouseEnter}
                        onMouseLeave={handleCellMouseLeave}
                      >
                        {entry ? (
                          <EntryCard
                            entry={entry}
                            aromas={aromas}
                            isHovered={isHovered}
                            hasConflict={cellConflicts.length > 0}
                          />
                        ) : (
                          <div className="w-full h-[88px] border border-dashed border-spa-bg-secondary rounded-xl text-spa-text-secondary/30 hover:border-spa-primary/35 hover:text-spa-primary/50 hover:bg-spa-bg-primary/50 transition-all flex items-center justify-center">
                            <Plus className="w-4 h-4" />
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Delete row */}
                  <td className="px-2 py-3">
                    <button
                      data-row-idx={timeRowIndex}
                      onClick={handleDeleteClick}
                      className="p-2 text-spa-text-secondary/20 hover:text-spa-error hover:bg-spa-error-light rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center opacity-0 group-hover:opacity-100"
                      title="Zeitreihe löschen"
                      aria-label="Zeitreihe löschen"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add slot */}
      <div className="border-t border-spa-bg-secondary p-3">
        <button
          onClick={onAddTimeRow}
          className="w-full px-4 py-2.5 border border-dashed border-spa-primary/20 rounded-xl text-spa-primary hover:border-spa-primary/50 hover:bg-spa-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Zeitslot hinzufügen
        </button>
      </div>
    </div>
  );
}
