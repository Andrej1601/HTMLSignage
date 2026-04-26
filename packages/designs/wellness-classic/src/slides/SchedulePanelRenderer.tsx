import type {
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelStyle,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import {
  IntensityFlames,
  SchedulePanelGrid,
  resolveSaunaAccent,
  withAlpha,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { scaled, scaledFont } from './responsive';

/**
 * Wellness Classic — content-panel renderer.
 *
 * Dispatches on the host-supplied `styleHint`:
 *   - `list`     → chronological list (one row per aufguss, sorted by time)
 *   - `matrix`   → Saunakacheln grid (one column per sauna, stacked cards)
 *   - `timeline` → proportional time axis (cards sized by duration)
 *
 * Each variant uses the pack's tokens so palette / tenant overrides flow
 * through consistently regardless of which layout the host picks.
 */
export function SchedulePanelRenderer(props: SlideRendererProps<'content-panel'>) {
  const hint: SchedulePanelStyle = props.data.styleHint ?? 'list';
  switch (hint) {
    case 'matrix':
      return <SchedulePanelGrid {...props} />;
    case 'timeline':
      return <TimelineVariant {...props} />;
    case 'list':
    default:
      return <ListVariant {...props} />;
  }
}

// ────────────────────────────────────────────────────────────────────────
// Variant: List (chronological)
// ────────────────────────────────────────────────────────────────────────

interface FlatEntry {
  key: string;
  time: string;
  saunaIndex: number;
  saunaName: string;
  cell: SchedulePanelCell;
}

function flattenEntries(data: SchedulePanelData): FlatEntry[] {
  const result: FlatEntry[] = [];
  data.cells.forEach((saunaRow, saunaIdx) => {
    saunaRow.forEach((cell, slotIdx) => {
      if (!cell) return;
      const time = cell.time ?? data.timeSlots[slotIdx] ?? '';
      result.push({
        key: `${saunaIdx}-${slotIdx}-${time}`,
        time,
        saunaIndex: saunaIdx,
        saunaName: data.saunas[saunaIdx]?.name ?? '',
        cell,
      });
    });
  });
  // Sort by HH:mm ascending
  result.sort((a, b) => {
    const [ah, am] = a.time.split(':').map((x) => Number.parseInt(x, 10) || 0);
    const [bh, bm] = b.time.split(':').map((x) => Number.parseInt(x, 10) || 0);
    return ah * 60 + am - (bh * 60 + bm);
  });
  return result;
}

function ListVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);
  const pad = scaled(24, viewport, 8);

  if (entries.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
        }}
      >
        Heute keine Einträge geplant.
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(12, viewport, 4)}px`,
      }}
    >
      {/* Legend strip: which sauna has which colour */}
      <div
        className="flex flex-wrap shrink-0"
        style={{ gap: `${scaled(12, viewport, 4)}px` }}
      >
        {data.saunas.map((sauna, idx) => {
          const accent = resolveSaunaAccent(sauna, idx, tokens);
          return (
            <span
              key={sauna.id}
              className="inline-flex items-center font-black uppercase"
              style={{
                gap: `${scaled(6, viewport, 3)}px`,
                color: colors.textSecondary,
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm * 0.9,
                  viewport,
                  8,
                )}px`,
                letterSpacing: '0.2em',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: scaled(8, viewport, 5),
                  height: scaled(8, viewport, 5),
                  borderRadius: '9999px',
                  backgroundColor: accent,
                  display: 'inline-block',
                }}
              />
              {sauna.name}
            </span>
          );
        })}
      </div>

      <AutoScroll className="flex-1 min-h-0">
        <div className="flex flex-col" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
          {entries.map((entry, idx) => (
            <ListEntryRow
              sauna={data.saunas[entry.saunaIndex]}
              key={entry.key}
              entry={entry}
              zebra={idx % 2 === 0}
              tokens={tokens}
              viewport={viewport}
            />
          ))}
        </div>
      </AutoScroll>
    </div>
  );
}

function ListEntryRow({
  sauna,
  entry,
  zebra,
  tokens,
  viewport,
}: {
  sauna: SchedulePanelData['saunas'][number];
  entry: FlatEntry;
  zebra: boolean;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const { cell } = entry;
  const accent = resolveSaunaAccent(sauna, entry.saunaIndex, tokens);

  const isLive = cell.isLive;
  const isPre = cell.isPrestart;
  const isNext = cell.isNext;
  const isFinished = cell.isFinished;

  // Row tint: live > prestart > next > finished > zebra
  const bg = isLive
    ? withAlpha(colors.statusLive, 0.12)
    : isPre
      ? withAlpha(colors.statusWarning, 0.1)
      : isNext
        ? withAlpha(colors.statusNext, 0.1)
        : isFinished
          ? withAlpha(colors.surfaceElevated, zebra ? 0.4 : 0.25)
          : withAlpha(colors.surfaceElevated, zebra ? 0.75 : 0.45);

  const leftBorderColor = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isNext
        ? colors.statusNext
        : accent;

  const timeColor = isLive
    ? colors.statusLive
    : isPre || isNext
      ? colors.statusWarning
      : isFinished
        ? withAlpha(colors.textPrimary, 0.35)
        : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  const flameActive = isFinished
    ? withAlpha(colors.accentPrimary, 0.35)
    : isLive
      ? colors.statusLive
      : isPre || isNext
        ? colors.statusWarning
        : colors.accentPrimary;
  const flameIdle = withAlpha(colors.accentPrimary, 0.2);

  // Status badge (solid pill in the right-most slot)
  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : isNext
        ? { label: 'GLEICH', color: colors.statusNext }
        : isFinished
          ? { label: 'VORBEI', color: withAlpha(colors.textPrimary, 0.55) }
          : null;

  const intensity = cell.intensity ?? 0;
  const duration = cell.durationMin ?? 15;

  return (
    <div
      className="flex items-center"
      style={{
        backgroundColor: bg,
        borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
        borderLeft: `${scaled(5, viewport, 3)}px solid ${leftBorderColor}`,
        padding: `${scaled(10, viewport, 4)}px ${scaled(16, viewport, 6)}px`,
        gap: `${scaled(14, viewport, 5)}px`,
      }}
    >
      {/* Time column */}
      <span
        className="font-mono font-black shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          minWidth: `${scaled(70, viewport, 44)}px`,
        }}
      >
        {entry.time}
      </span>

      {/* Sauna tag */}
      <span
        className="inline-flex items-center font-black uppercase shrink-0"
        style={{
          gap: `${scaled(6, viewport, 3)}px`,
          color: colors.textSecondary,
          fontSize: `${scaledFont(
            typography.baseSizePx * typography.scaleSm * 0.95,
            viewport,
            8,
          )}px`,
          letterSpacing: '0.2em',
          minWidth: `${scaled(140, viewport, 80)}px`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: scaled(8, viewport, 5),
            height: scaled(8, viewport, 5),
            borderRadius: '9999px',
            backgroundColor: accent,
            display: 'inline-block',
          }}
        />
        <span className="truncate">{entry.saunaName}</span>
      </span>

      {/* Title */}
      <span
        className="font-black uppercase truncate flex-1 min-w-0"
        style={{
          color: titleColor,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          letterSpacing: '0.04em',
        }}
      >
        {cell.title}
      </span>

      {/* Flames */}
      {intensity > 0 ? (
        <IntensityFlames
          level={intensity}
          size={scaled(14, viewport, 9)}
          activeColor={flameActive}
          idleColor={flameIdle}
        />
      ) : null}

      {/* Duration pill */}
      <span
        className="font-bold shrink-0"
        style={{
          color: withAlpha(colors.textPrimary, 0.55),
          backgroundColor: withAlpha(colors.surfaceElevated, 0.7),
          border: `1px solid ${withAlpha(colors.border, 0.7)}`,
          borderRadius: `${radius.pill}px`,
          fontSize: `${scaledFont(
            typography.baseSizePx * typography.scaleSm * 0.9,
            viewport,
            8,
          )}px`,
          padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
          letterSpacing: '0.1em',
        }}
      >
        {duration} MIN
      </span>

      {/* Status badge */}
      <span
        className="shrink-0"
        style={{
          minWidth: `${scaled(80, viewport, 48)}px`,
          textAlign: 'center',
        }}
      >
        {badge ? (
          <span
            className="inline-flex items-center justify-center font-black uppercase"
            style={{
              color: colors.textInverse,
              backgroundColor: badge.color,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.85,
                viewport,
                7,
              )}px`,
              padding: `${scaled(3, viewport, 2)}px ${scaled(10, viewport, 4)}px`,
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.18em',
              lineHeight: 1.3,
            }}
          >
            {badge.label}
          </span>
        ) : null}
      </span>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────
// Variant: Timeline (modern-timeline)
// ────────────────────────────────────────────────────────────────────────
//
// Event-indexed grid: left column = unique aufguss start times (only the
// ones that actually have entries — empty time gaps are collapsed so the
// total scroll length stays proportional to the *number* of events, not
// to the length of the operating day). Each row is a fixed height so
// cards look consistent regardless of their real duration.

function parseTime(time: string): number {
  const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10) || 0);
  return h * 60 + m;
}

function formatTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Step for filler time slots shown between real aufguss times. */
const TIMELINE_SLOT_STEP_MIN = 30;

function TimelineVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography } = tokens;
  const { viewport } = context;

  // Collect every non-empty cell, remember its sauna + slot origin.
  interface TimelineEntry {
    key: string;
    saunaIndex: number;
    time: string;
    cell: SchedulePanelCell;
  }
  const allEntries: TimelineEntry[] = data.cells.flatMap((row, saunaIdx) =>
    (row ?? []).flatMap((cell, slotIdx) => {
      if (!cell) return [];
      const time = cell.time ?? data.timeSlots[slotIdx] ?? '';
      if (!time) return [];
      return [{
        key: `${saunaIdx}-${slotIdx}-${time}`,
        saunaIndex: saunaIdx,
        time,
        cell,
      }];
    }),
  );

  if (data.saunas.length === 0 || allEntries.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
        }}
      >
        Keine Aufgüsse für die Timeline geplant.
      </div>
    );
  }

  // Build the time axis: every half-hour tick between the earliest
  // aufguss and the latest end time, plus any real event times that
  // don't fall on a 30-minute boundary (so e.g. 15:30 + 15:45 would
  // both show up). Preserves a recognisable "time grid" while still
  // letting off-beat entries appear where they belong.
  const entryStartMinutes = allEntries.map((e) => parseTime(e.time));
  const entryEndMinutes = allEntries.map(
    (e) => parseTime(e.time) + (e.cell.durationMin ?? 15),
  );
  const earliest = Math.min(...entryStartMinutes);
  const latest = Math.max(...entryEndMinutes);
  const axisStart =
    Math.floor(earliest / TIMELINE_SLOT_STEP_MIN) * TIMELINE_SLOT_STEP_MIN;
  const axisEnd =
    Math.ceil(latest / TIMELINE_SLOT_STEP_MIN) * TIMELINE_SLOT_STEP_MIN;

  const axisMinutes = new Set<number>();
  for (let m = axisStart; m <= axisEnd; m += TIMELINE_SLOT_STEP_MIN) {
    axisMinutes.add(m);
  }
  for (const m of entryStartMinutes) axisMinutes.add(m);

  const uniqueTimes = Array.from(axisMinutes)
    .sort((a, b) => a - b)
    .map(formatTime);

  const pad = scaled(20, viewport, 6);
  const timeColWidth = scaled(72, viewport, 38);
  // Minimum row height — rows are free to grow beyond this when there's
  // room in the container, via `minmax(minPx, 1fr)` below. Prevents
  // visual cramming when few events are scheduled while keeping things
  // legible when many events squeeze into the zone (auto-scroll).
  const minRowHeightPx = scaled(44, viewport, 24);
  const rowGapPx = scaled(6, viewport, 2);

  // Fast lookup of "entry at (sauna, time)".
  const entryAt = new Map<string, TimelineEntry>();
  for (const entry of allEntries) {
    entryAt.set(`${entry.saunaIndex}:${entry.time}`, entry);
  }

  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(12, viewport, 4)}px`,
      }}
    >
      {/* Sauna header row */}
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          gap: `${rowGapPx}px`,
        }}
      >
        <div />
        {data.saunas.map((sauna, idx) => {
          const accent = resolveSaunaAccent(sauna, idx, tokens);
          return (
            <div
              key={sauna.id}
              className="flex items-center"
              style={{
                gap: `${scaled(6, viewport, 2)}px`,
                paddingBottom: `${scaled(6, viewport, 2)}px`,
                borderBottom: `2px solid ${withAlpha(colors.border, 0.7)}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: scaled(8, viewport, 4),
                  height: scaled(8, viewport, 4),
                  borderRadius: '9999px',
                  backgroundColor: sauna.outOfOrder
                    ? withAlpha(colors.textPrimary, 0.25)
                    : accent,
                  display: 'inline-block',
                }}
              />
              <span
                className="font-black uppercase truncate flex-1 min-w-0"
                style={{
                  color: sauna.outOfOrder
                    ? withAlpha(colors.textPrimary, 0.45)
                    : colors.textPrimary,
                  fontSize: `${scaledFont(
                    typography.baseSizePx * typography.scaleSm,
                    viewport,
                    8,
                  )}px`,
                  letterSpacing: '0.16em',
                }}
                title={sauna.name}
              >
                {sauna.name}
              </span>
              {!sauna.outOfOrder && typeof sauna.temperatureC === 'number' ? (
                <span
                  className="font-bold shrink-0"
                  style={{
                    color: colors.accentPrimary,
                    fontSize: `${scaledFont(
                      typography.baseSizePx * typography.scaleSm * 0.85,
                      viewport,
                      8,
                    )}px`,
                  }}
                >
                  {sauna.temperatureC}°
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Event rows — one per unique start time. The grid stretches to
          fill the available height (so few events use the whole zone
          instead of clustering at the top) but each row has a minimum
          height so many events can't squeeze to an unreadable size.
          Auto-scroll takes over when min-heights exceed the zone. */}
      <AutoScroll className="flex-1 min-h-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            gridTemplateRows: `repeat(${uniqueTimes.length}, minmax(${minRowHeightPx}px, 1fr))`,
            columnGap: `${rowGapPx}px`,
            rowGap: `${scaled(4, viewport, 1)}px`,
            minHeight: '100%',
          }}
        >
          {uniqueTimes.map((time) => (
            <TimelineRow
              key={time}
              time={time}
              saunas={data.saunas}
              entryAt={entryAt}
              tokens={tokens}
              viewport={viewport}
            />
          ))}
        </div>
      </AutoScroll>
    </div>
  );
}

function TimelineRow({
  time,
  saunas,
  entryAt,
  tokens,
  viewport,
}: {
  time: string;
  saunas: SchedulePanelData['saunas'];
  entryAt: Map<string, { key: string; saunaIndex: number; time: string; cell: SchedulePanelCell }>;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  // Each child spans exactly one grid row; `h-full` lets them expand to
  // fill whatever height the outer grid assigned this row (minmax).
  return (
    <>
      {/* Time label (left axis column) */}
      <div
        className="font-mono font-black tabular-nums flex items-center justify-end h-full"
        style={{
          color: colors.accentPrimary,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
          paddingRight: `${scaled(8, viewport, 3)}px`,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        {time}
      </div>

      {/* One cell per sauna */}
      {saunas.map((sauna, idx) => {
        const accent = resolveSaunaAccent(sauna, idx, tokens);
        if (sauna.outOfOrder) {
          return (
            <div
              key={`${time}-${sauna.id}`}
              className="flex items-center justify-center h-full"
              style={{
                borderRadius: `${scaled(radius.sm, viewport, 3)}px`,
                backgroundColor: withAlpha(colors.surfaceElevated, 0.4),
                color: withAlpha(colors.textPrimary, 0.4),
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm * 0.8,
                  viewport,
                  7,
                )}px`,
                letterSpacing: '0.18em',
                fontWeight: 900,
                textTransform: 'uppercase',
              }}
            >
              Außer Betrieb
            </div>
          );
        }
        const entry = entryAt.get(`${idx}:${time}`);
        if (!entry) {
          return (
            <div
              key={`${time}-${sauna.id}`}
              className="flex items-center justify-center h-full"
              style={{
                color: withAlpha(colors.textSecondary, 0.35),
                fontFamily: typography.fontMono,
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm,
                  viewport,
                  8,
                )}px`,
              }}
            >
              —
            </div>
          );
        }
        return (
          <TimelineCell
            key={`${time}-${sauna.id}`}
            entry={entry}
            accent={accent}
            tokens={tokens}
            viewport={viewport}
          />
        );
      })}
    </>
  );
}

function TimelineCell({
  entry,
  accent,
  tokens,
  viewport,
}: {
  entry: { key: string; saunaIndex: number; time: string; cell: SchedulePanelCell };
  accent: string;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const { cell } = entry;
  const isLive = cell.isLive;
  const isPre = cell.isPrestart;
  const isNext = cell.isNext;
  const isFinished = cell.isFinished;

  const bg = isLive
    ? withAlpha(colors.statusLive, 0.18)
    : isPre
      ? withAlpha(colors.statusWarning, 0.16)
      : isNext
        ? withAlpha(colors.statusNext, 0.16)
        : isFinished
          ? withAlpha(colors.surfaceElevated, 0.4)
          : withAlpha(colors.surfaceElevated, 0.9);

  const border = isLive
    ? withAlpha(colors.statusLive, 0.5)
    : isPre
      ? withAlpha(colors.statusWarning, 0.4)
      : isNext
        ? withAlpha(colors.statusNext, 0.4)
        : withAlpha(colors.border, 0.7);

  const leftBar = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isNext
        ? colors.statusNext
        : accent;

  const titleColor = isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary;

  const flameActive = isFinished
    ? withAlpha(colors.accentPrimary, 0.35)
    : isLive
      ? colors.statusLive
      : isPre || isNext
        ? colors.statusWarning
        : accent;
  const flameIdle = withAlpha(colors.accentPrimary, 0.2);

  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : isNext
        ? { label: 'GLEICH', color: colors.statusNext }
        : isFinished
          ? { label: 'VORBEI', color: withAlpha(colors.textPrimary, 0.55) }
          : null;

  const intensity = cell.intensity ?? 0;
  const duration = cell.durationMin ?? 15;
  const hasMinorRow = Boolean(badge) || intensity > 0;

  return (
    <div
      className="flex items-center h-full"
      style={{
        backgroundColor: bg,
        borderRadius: `${scaled(radius.md, viewport, 4)}px`,
        border: `1px solid ${border}`,
        borderLeft: `${scaled(4, viewport, 2)}px solid ${leftBar}`,
        padding: `${scaled(4, viewport, 2)}px ${scaled(10, viewport, 4)}px`,
        gap: `${scaled(8, viewport, 3)}px`,
        opacity: isFinished ? 0.85 : 1,
        overflow: 'hidden',
      }}
    >
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 1 }}>
        <span
          className="font-black uppercase truncate"
          style={{
            color: titleColor,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
            lineHeight: 1.15,
            letterSpacing: '0.04em',
          }}
        >
          {cell.title}
        </span>
        {hasMinorRow ? (
          <div
            className="flex items-center"
            style={{ gap: `${scaled(6, viewport, 2)}px` }}
          >
            {intensity > 0 ? (
              <IntensityFlames
                level={intensity}
                size={scaled(10, viewport, 7)}
                activeColor={flameActive}
                idleColor={flameIdle}
              />
            ) : null}
            {badge ? (
              <span
                className="font-black uppercase shrink-0"
                style={{
                  color: colors.textInverse,
                  backgroundColor: badge.color,
                  fontSize: `${scaledFont(
                    typography.baseSizePx * typography.scaleSm * 0.8,
                    viewport,
                    7,
                  )}px`,
                  padding: `${scaled(1, viewport, 1)}px ${scaled(6, viewport, 2)}px`,
                  borderRadius: `${radius.pill}px`,
                  letterSpacing: '0.16em',
                  lineHeight: 1.3,
                }}
              >
                {badge.label}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span
        className="font-bold shrink-0"
        style={{
          color: withAlpha(colors.textPrimary, 0.55),
          backgroundColor: withAlpha(colors.border, 0.3),
          borderRadius: `${radius.pill}px`,
          padding: `${scaled(1, viewport, 1)}px ${scaled(7, viewport, 3)}px`,
          fontSize: `${scaledFont(
            typography.baseSizePx * typography.scaleSm * 0.8,
            viewport,
            7,
          )}px`,
          letterSpacing: '0.1em',
        }}
      >
        {duration} MIN
      </span>
    </div>
  );
}
