/**
 * Live-Puls — Echtzeit-Übersicht über den laufenden Tag.
 *
 * Zeigt dem Saunameister auf einen Blick:
 *  - Welcher Wochenplan / welches Event-Preset gerade aktiv ist
 *  - Welcher Aufguss-Slot gerade läuft (Sauna für Sauna)
 *  - Wie weit der Tag fortgeschritten ist
 *  - Wann der nächste Wechsel ansteht (Countdown)
 *
 * Tickt jede Minute. Alles aus den bereits geladenen Schedule- und
 * Settings-Daten — kein zusätzlicher Backend-Roundtrip.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  Flame,
  Sparkles,
} from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import type { DashboardLiveState } from '@/hooks/useDashboardData';
import type { PresetKey, Schedule, TimeRow } from '@/types/schedule.types';
import { PRESET_LABELS, sortTimeRows, normalizeSaunaNameKey } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import { SAUNA_STATUS_LABELS, SAUNA_STATUS_COLORS, getVisibleSaunas } from '@/types/sauna.types';
import clsx from 'clsx';

interface OperationsPulseWidgetProps {
  liveState: DashboardLiveState;
  nextEventLabel: string;
  activePreset: PresetKey | null;
  autoPlay: boolean;
  schedule: Schedule | null;
  settings: Settings | null;
}

// ── Hilfsfunktionen (lokal — Duplizierung zu ScheduleGrid bewusst, bis es ein shared util gibt) ──

function parseTimeMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Index der Zeile, deren `time <= nowMinutes`. -1 vor dem ersten Slot. */
function getCurrentRowIndex(rows: Array<{ time: string }>, nowMinutes: number): number {
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (parseTimeMinutes(rows[i].time) <= nowMinutes) idx = i;
    else break;
  }
  return idx;
}

function formatCountdown(minutes: number): string {
  if (minutes < 1) return 'gleich';
  if (minutes < 60) return `in ${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} Std.` : `in ${h} Std. ${m} Min.`;
}

function formatTimeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ── Sub-Components ──────────────────────────────────────────────────────────────

function FlameIcons({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-px shrink-0" aria-label={`Intensität ${count} von 4`}>
      {Array.from({ length: count }).map((_, i) => (
        <Flame key={i} className="h-3 w-3 text-spa-warning fill-spa-warning" aria-hidden="true" />
      ))}
    </span>
  );
}

// ── Main Widget ─────────────────────────────────────────────────────────────────

export function OperationsPulseWidget({
  liveState,
  nextEventLabel,
  activePreset,
  autoPlay,
  schedule,
  settings,
}: OperationsPulseWidgetProps) {
  // Tick alle 60 s. Reicht für Minuten-Granularität — die Anzeige hat
  // keine Sekunden-Komponente.
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const presetLabel = activePreset ? PRESET_LABELS[activePreset] : 'Kein Plan aktiv';
  const activeEvent = liveState.activeEvent;
  const hasActiveEvent = Boolean(activeEvent);

  const day = activePreset && schedule?.presets?.[activePreset];
  // Wir sortieren defensiv — `getCurrentRowIndex` und die `find` für
  // `nextRow` setzen chronologische Reihenfolge voraus. Manuelle
  // Bearbeitung im Schedule-Editor speichert nicht garantiert sortiert.
  const rows: TimeRow[] = useMemo(() => sortTimeRows(day?.rows ?? []), [day?.rows]);
  const dayHasRows = rows.length > 0;

  const currentRowIdx = useMemo(() => getCurrentRowIndex(rows, nowMinutes), [rows, nowMinutes]);
  const currentRow = currentRowIdx >= 0 ? rows[currentRowIdx] ?? null : null;
  const nextRow = useMemo(
    () => rows.find((r) => parseTimeMinutes(r.time) > nowMinutes) ?? null,
    [rows, nowMinutes],
  );
  const countdownMin = nextRow ? Math.max(0, parseTimeMinutes(nextRow.time) - nowMinutes) : null;
  const progressFraction =
    dayHasRows && currentRowIdx >= 0
      ? Math.min(1, (currentRowIdx + 1) / rows.length)
      : 0;

  // Sichtbare Saunen aus den Settings — `getVisibleSaunas` filtert
  // `hidden` raus und sortiert nach `order`. Die Sauna-Reihenfolge
  // im Schedule (`day.saunas`) MUSS damit übereinstimmen, sonst
  // landen wir auf der falschen Spalte. Daher mappen wir per Name
  // statt Index, um auf der sicheren Seite zu sein.
  const saunaList = settings?.saunas;
  const visibleSaunas = useMemo(
    () => (saunaList ? getVisibleSaunas(saunaList) : []),
    [saunaList],
  );

  // Sauna-Index im Schedule per normalisiertem Schlüssel auflösen — so
  // bleiben Slots auch dann korrekt zugeordnet, wenn der Saunaname zwischen
  // Settings und Schedule leichte Schreibvarianten hat (Bindestriche,
  // Leerzeichen, Großschreibung).
  const saunaIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    (day ? day.saunas : []).forEach((name, idx) => {
      map.set(normalizeSaunaNameKey(name), idx);
    });
    return map;
  }, [day]);

  const saunaSlots = useMemo(() => {
    return visibleSaunas.map((sauna) => {
      const scheduleIdx = saunaIndexByKey.get(normalizeSaunaNameKey(sauna.name)) ?? -1;
      const entry =
        currentRow && scheduleIdx >= 0
          ? currentRow.entries[scheduleIdx] ?? null
          : null;
      return { sauna, entry };
    });
  }, [visibleSaunas, saunaIndexByKey, currentRow]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="rounded-2xl border border-spa-bg-secondary bg-spa-surface p-6 shadow-xs">
      {/* Header — animierter Live-Indicator wenn ein Plan aktiv ist */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3 text-spa-text-primary">
          <span className="relative flex h-10 w-10 items-center justify-center shrink-0">
            {activePreset && (
              <span
                className="absolute inline-flex h-full w-full rounded-2xl bg-spa-success opacity-20 motion-safe:animate-ping"
                aria-hidden="true"
              />
            )}
            <span
              className={clsx(
                'relative inline-flex h-10 w-10 items-center justify-center rounded-2xl',
                activePreset ? 'bg-spa-primary/10 text-spa-primary' : 'bg-spa-bg-secondary text-spa-text-secondary',
              )}
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </span>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Live-Puls
              <span className="text-xs font-mono text-spa-text-secondary tabular-nums" aria-label="Aktuelle Uhrzeit">
                {formatTimeLabel(nowMinutes)}
              </span>
            </h3>
            <p className="mt-0.5 text-sm text-spa-text-secondary">
              Was gerade läuft und wann der nächste Wechsel ansteht.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            label={autoPlay ? 'Auto-Play aktiv' : 'Manueller Modus'}
            tone={autoPlay ? 'success' : 'warning'}
            showDot={false}
          />
          <StatusBadge
            label={hasActiveEvent ? 'Event live' : 'Regelbetrieb'}
            tone={hasActiveEvent ? 'info' : 'neutral'}
            showDot={false}
          />
        </div>
      </div>

      {/* Hero — aktiver Preset + Tagesfortschritt + Countdown.
          Live-Region: Screen-Reader hören Countdown-/Slot-Wechsel. */}
      <Link
        to="/schedule"
        role="status"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Aktiver Tagesplan und nächster Wechsel — zum Aufgussplan-Editor"
        className={clsx(
          'mt-5 grid gap-4 rounded-2xl p-4 lg:grid-cols-2 transition-all hover:shadow-xs hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spa-primary focus-visible:ring-offset-2',
          hasActiveEvent
            ? 'border-l-4 border-spa-info bg-spa-info-light/30 border-y border-r border-spa-bg-secondary'
            : 'border border-spa-bg-secondary bg-spa-bg-primary/50',
        )}
      >
        {/* Linke Hälfte: aktiver Preset / Status */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary">
            Jetzt aktiv
          </p>
          <p className="mt-1 text-2xl font-bold text-spa-text-primary leading-tight">
            {presetLabel}
          </p>
          {hasActiveEvent && activeEvent && (
            <p className="mt-1 text-sm font-medium text-spa-info-dark truncate" title={activeEvent.name}>
              <span aria-hidden="true">▸ </span>
              {activeEvent.name}
              {activeEvent.endTime && (
                <span className="text-spa-text-secondary"> · bis {activeEvent.endTime}</span>
              )}
            </p>
          )}
          {!activePreset && (
            <p className="mt-1 text-sm text-spa-text-secondary">
              Aktuell ist kein Tagesplan aktiv. Auto-Play oder Event-Override prüfen.
            </p>
          )}
          {activePreset && !dayHasRows && (
            <p className="mt-1 text-sm text-spa-text-secondary">Tagesplan leer — keine Aufgüsse vorhanden.</p>
          )}
        </div>

        {/* Rechte Hälfte: Countdown + Fortschritt */}
        <div className="min-w-0 flex flex-col justify-between gap-3">
          {dayHasRows ? (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  Nächster Wechsel
                </p>
                {nextRow && countdownMin !== null ? (
                  <p className="mt-1 text-lg font-semibold text-spa-text-primary leading-tight">
                    <span className="text-spa-primary">{formatCountdown(countdownMin)}</span>
                    <span className="text-spa-text-secondary"> · um {nextRow.time}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-spa-text-secondary">
                    Letzter Aufguss des Tages
                    {currentRow && <> · seit {currentRow.time}</>}
                  </p>
                )}
              </div>
              {/* Tagesfortschritt-Balken */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-spa-text-secondary mb-1">
                  <span>Tagesfortschritt</span>
                  <span className="font-mono tabular-nums">
                    {Math.max(0, currentRowIdx + 1)} / {rows.length} Slots
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full bg-spa-primary/15 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round(progressFraction * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Tagesfortschritt"
                  aria-valuetext={`Slot ${Math.max(0, currentRowIdx + 1)} von ${rows.length}`}
                >
                  <div
                    className="h-full bg-spa-primary transition-all duration-500"
                    style={{ width: `${Math.round(progressFraction * 100)}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-spa-text-secondary">
              {nextEventLabel && nextEventLabel !== 'Kein aktives Event'
                ? `Nächster Termin: ${nextEventLabel}`
                : 'Aktuell sind keine Aufgüsse geplant.'}
            </p>
          )}
        </div>
      </Link>

      {/* Sauna-Slots: aktueller Aufguss pro Sauna */}
      {visibleSaunas.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-spa-text-secondary mb-2">
            Saunen — aktueller Slot
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {saunaSlots.map(({ sauna, entry }) => {
              const isActiveStatus = sauna.status === 'active';
              const showEntry = isActiveStatus && entry;
              const statusColor = SAUNA_STATUS_COLORS[sauna.status];

              return (
                <div
                  key={sauna.id}
                  className={clsx(
                    'rounded-xl border p-2.5 min-h-[68px]',
                    showEntry
                      ? 'border-spa-bg-secondary bg-spa-surface shadow-xs'
                      : 'border-spa-bg-secondary/60 bg-spa-bg-primary/40',
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {sauna.color && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: sauna.color }}
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs font-semibold text-spa-text-primary truncate" title={sauna.name}>
                      {sauna.name}
                    </span>
                  </div>
                  {showEntry ? (
                    <div className="mt-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-sm font-medium text-spa-text-primary leading-tight line-clamp-2 min-w-0" title={entry.title}>
                          {entry.title}
                        </p>
                        {typeof entry.flames === 'number' && entry.flames > 0 && (
                          <FlameIcons count={entry.flames} />
                        )}
                      </div>
                      {entry.subtitle && (
                        <p className="mt-0.5 text-[10px] text-spa-text-secondary line-clamp-1">{entry.subtitle}</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: statusColor }}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] text-spa-text-secondary">
                        {isActiveStatus ? (currentRow ? 'Pause' : '—') : SAUNA_STATUS_LABELS[sauna.status]}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer: nächstes Event-Hint, nur wenn relevant */}
      {!hasActiveEvent && nextEventLabel && nextEventLabel !== 'Kein aktives Event' && (
        <div className="mt-3 flex items-center gap-2 text-xs text-spa-text-secondary">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title={nextEventLabel}>
            Nächstes Event: {nextEventLabel}
          </span>
        </div>
      )}
    </section>
  );
}
