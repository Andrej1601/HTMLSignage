/**
 * Card-Stack-Ansicht des Tagesplans für kleine Viewports (<lg).
 *
 * Statt einer breiten Matrix mit Zeit-Spalte links und Sauna-Spalten
 * werden die Zeitslots vertikal als Karten dargestellt. Jede Karte
 * zeigt die Uhrzeit als Kopfzeile (tappbar) und darunter pro Sauna
 * einen Stapel mit dem Entry oder einem leeren Slot zum Hinzufügen.
 *
 * Bewusst ohne ein eigenes State-Management: diese Komponente ist eine
 * reine View — alle Interaktionen werden über Callbacks an den Editor
 * weitergereicht, exakt wie bei `ScheduleGrid`.
 */
import { memo, useEffect, useMemo, useState } from 'react';
import type { DaySchedule, Entry } from '@/types/schedule.types';
import type { Aroma } from '@/types/settings.types';
import type { Sauna } from '@/types/sauna.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS } from '@/types/sauna.types';
import { resolveAromaForBadge, getAromaDisplayColor } from '@/types/settings.types';
import { detectConflicts, getConflictsForCell } from '@/utils/scheduleConflicts';
import { Plus, Trash2, Flame, Clock, AlertTriangle, Pencil, ChevronRight } from 'lucide-react';
import { Button } from '@/components/Button';
import clsx from 'clsx';

interface ScheduleStackViewProps {
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

function getCurrentRowIndex(rows: DaySchedule['rows'], nowMinutes: number): number {
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (parseTimeMinutes(rows[i].time) <= nowMinutes) idx = i;
    else break;
  }
  return idx;
}

const FlameIcons = memo(function FlameIcons({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-px shrink-0">
      {Array.from({ length: count }).map((_, i) => (
        <Flame key={i} className="w-3.5 h-3.5 text-spa-warning fill-spa-warning" />
      ))}
    </span>
  );
});

const StackEntry = memo(function StackEntry({
  entry,
  aromas,
  hasConflict,
}: {
  entry: Entry;
  aromas: Aroma[];
  hasConflict: boolean;
}) {
  return (
    <div
      className={clsx(
        'relative rounded-lg px-3 py-2 border',
        hasConflict
          ? 'border-spa-warning/50 bg-spa-warning-light/40'
          : 'border-spa-bg-secondary bg-spa-surface',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-spa-text-primary leading-tight min-w-0 truncate">
          {entry.title || 'Kein Titel'}
        </h4>
        {entry.flames && <FlameIcons count={entry.flames} />}
      </div>
      {entry.subtitle && (
        <p className="text-xs text-spa-text-secondary mt-0.5 leading-snug line-clamp-2">
          {entry.subtitle}
        </p>
      )}
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
      {entry.duration && (
        <div className="flex items-center gap-1 mt-1.5">
          <Clock className="w-3 h-3 text-spa-text-secondary/50" />
          <span className="text-[11px] text-spa-text-secondary">{entry.duration} Min</span>
        </div>
      )}
      {hasConflict && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <AlertTriangle className="w-4 h-4 text-spa-warning-dark drop-shadow-sm" />
        </div>
      )}
    </div>
  );
});

export function ScheduleStackView({
  daySchedule,
  aromas = [],
  saunaColors = {},
  saunaObjects = [],
  onEditCell,
  onEditTime,
  onAddTimeRow,
  onDeleteTimeRow,
}: ScheduleStackViewProps) {
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

  const conflicts = useMemo(() => detectConflicts(daySchedule), [daySchedule]);
  const currentRowIdx = useMemo(
    () => getCurrentRowIndex(daySchedule.rows, nowMinutes),
    [daySchedule.rows, nowMinutes],
  );

  const saunaByName = useMemo(() => {
    const map: Record<string, Sauna> = {};
    saunaObjects.forEach((s) => {
      map[s.name] = s;
    });
    return map;
  }, [saunaObjects]);

  // Aktuelle Zeile standardmäßig aufgeklappt; alle anderen kompakt
  // (zeigt nur belegte Slots). User kann pro Zeile selbst toggeln.
  // Render-phase: wenn die "aktuelle Zeile" wechselt (Tageszeit-Tick),
  // expandieren wir die neue Zeile, ohne bestehende User-Expansionen
  // zu zerstören. Tracked-Vorgängerwert sorgt dafür, dass wir nur auf
  // den Übergang reagieren — nicht auf jeden Render.
  const [expandedRows, setExpandedRows] = useState<Set<number>>(() => new Set());
  const [prevCurrentRowIdx, setPrevCurrentRowIdx] = useState(currentRowIdx);
  if (currentRowIdx !== prevCurrentRowIdx) {
    setPrevCurrentRowIdx(currentRowIdx);
    if (currentRowIdx >= 0 && !expandedRows.has(currentRowIdx)) {
      const next = new Set(expandedRows);
      next.add(currentRowIdx);
      setExpandedRows(next);
    }
  }

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (daySchedule.rows.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-spa-bg-primary mb-3">
          <Plus className="w-6 h-6 text-spa-text-secondary" />
        </div>
        <p className="text-spa-text-secondary mb-3 text-sm">Noch keine Aufgüsse für diesen Tag</p>
        <Button icon={Plus} onClick={onAddTimeRow} size="sm">
          Ersten Aufguss hinzufügen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {daySchedule.rows.map((timeRow, timeRowIndex) => {
        const isCurrentRow = timeRowIndex === currentRowIdx;
        const isExpanded = expandedRows.has(timeRowIndex);
        const filledCount = timeRow.entries.filter((e) => e !== null).length;

        // Bei eingeklapptem Zustand zeigen wir nur die Slots, die belegt
        // sind — sonst wird die Card unübersichtlich lang. Aufgeklappt
        // sieht der User auch leere Slots zum Hinzufügen.
        const visibleIndices = isExpanded
          ? timeRow.entries.map((_, i) => i)
          : timeRow.entries.map((e, i) => (e !== null ? i : -1)).filter((i) => i !== -1);

        return (
          <div
            key={timeRowIndex}
            className={clsx(
              'rounded-xl border overflow-hidden',
              isCurrentRow
                ? 'border-spa-success bg-spa-success-light/40 ring-2 ring-spa-success/30'
                : 'border-spa-bg-secondary bg-spa-surface',
            )}
          >
            {/* Time header — tap to expand/collapse, dedicated buttons for edit/delete */}
            <div
              className={clsx(
                'flex items-center gap-2 px-3 py-2.5 border-b',
                isCurrentRow ? 'border-spa-success/40' : 'border-spa-bg-secondary',
              )}
            >
              <button
                type="button"
                onClick={() => toggleRow(timeRowIndex)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                aria-expanded={isExpanded}
                aria-controls={`stack-row-${timeRowIndex}`}
              >
                <ChevronRight
                  className={clsx(
                    'w-4 h-4 shrink-0 transition-transform text-spa-text-secondary',
                    isExpanded && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
                <span
                  className={clsx(
                    'font-mono text-base font-bold tabular-nums',
                    isCurrentRow ? 'text-spa-success-dark' : 'text-spa-primary',
                  )}
                >
                  {timeRow.time}
                </span>
                {isCurrentRow && (
                  <span className="relative flex h-2 w-2 ml-1" aria-label="Aktueller Slot">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spa-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-spa-success" />
                  </span>
                )}
                <span className="text-xs text-spa-text-secondary ml-auto">
                  {filledCount}/{timeRow.entries.length} belegt
                </span>
              </button>
              <button
                type="button"
                onClick={() => onEditTime(timeRowIndex)}
                className="p-2 rounded-lg text-spa-text-secondary hover:text-spa-primary hover:bg-spa-bg-primary transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label={`Zeit ${timeRow.time} bearbeiten`}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteTimeRow(timeRowIndex)}
                className="p-2 rounded-lg text-spa-text-secondary hover:text-spa-error hover:bg-spa-error-light transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label={`Zeitreihe ${timeRow.time} löschen`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Stacked sauna list */}
            <div id={`stack-row-${timeRowIndex}`} className="divide-y divide-spa-bg-secondary/60">
              {visibleIndices.map((saunaIndex) => {
                const entry = timeRow.entries[saunaIndex];
                const saunaName = daySchedule.saunas?.[saunaIndex] ?? `Sauna ${saunaIndex + 1}`;
                const sauna = saunaByName[saunaName];
                const color = saunaColors[saunaName];
                const statusColor = sauna ? SAUNA_STATUS_COLORS[sauna.status] : '#10b981';
                const statusLabel = sauna ? SAUNA_STATUS_LABELS[sauna.status] : null;
                const cellConflicts = getConflictsForCell(conflicts, timeRowIndex, saunaIndex);
                const cellLabel = entry
                  ? `${timeRow.time}, ${saunaName}: ${entry.title}${entry.subtitle ? ' — ' + entry.subtitle : ''}`
                  : `${timeRow.time}, ${saunaName}: leerer Slot, zum Hinzufügen aktivieren`;

                return (
                  <button
                    key={saunaIndex}
                    type="button"
                    onClick={() => onEditCell(timeRowIndex, saunaIndex)}
                    aria-label={cellLabel}
                    className="w-full text-left px-3 py-2.5 flex items-stretch gap-3 hover:bg-spa-bg-primary/40 active:bg-spa-bg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-inset"
                  >
                    <div className="flex flex-col items-start gap-1 w-28 shrink-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {color && (
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-xs font-semibold text-spa-text-primary truncate">
                          {saunaName}
                        </span>
                      </div>
                      {statusLabel && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] text-spa-text-secondary"
                          aria-label={`Status: ${statusLabel}`}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: statusColor }}
                            aria-hidden="true"
                          />
                          {statusLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {entry ? (
                        <StackEntry
                          entry={entry}
                          aromas={aromas}
                          hasConflict={cellConflicts.length > 0}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full min-h-[60px] border border-dashed border-spa-bg-secondary rounded-lg text-spa-text-secondary/50 hover:border-spa-primary/40 hover:text-spa-primary/70 transition-colors">
                          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                          <span className="text-xs">Hinzufügen</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
              {!isExpanded && filledCount === 0 && (
                <button
                  type="button"
                  onClick={() => toggleRow(timeRowIndex)}
                  className="w-full px-3 py-3 text-xs text-spa-text-secondary hover:bg-spa-bg-primary/40 transition-colors"
                >
                  Aufklappen, um Saunen zu belegen
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add slot */}
      <button
        type="button"
        onClick={onAddTimeRow}
        className="w-full px-4 py-3 border border-dashed border-spa-primary/30 rounded-xl text-spa-primary hover:border-spa-primary/60 hover:bg-spa-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Zeitslot hinzufügen
      </button>
    </div>
  );
}
