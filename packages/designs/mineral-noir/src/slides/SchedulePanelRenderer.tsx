import type {
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelStyle,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — content-panel dispatcher.
 *
 * Three variants share the architectural vocabulary (hairline rules,
 * platinum accent, monospaced timestamps, generous whitespace) but
 * lay out the data differently:
 *   - list     — flat chronological feed, one row per entry
 *   - matrix   — time rows × sauna columns, half-hour grid
 *   - timeline — event-indexed rows, evenly stretched to fill height
 */
export function SchedulePanelRenderer(props: SlideRendererProps<'content-panel'>) {
  const hint: SchedulePanelStyle = props.data.styleHint ?? 'list';
  switch (hint) {
    case 'matrix':
      return <MatrixVariant {...props} />;
    case 'timeline':
      return <TimelineVariant {...props} />;
    case 'list':
    default:
      return <ListVariant {...props} />;
  }
}

// ── Shared ──────────────────────────────────────────────────────────────────

function parseTime(time: string): number {
  const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10) || 0);
  return h * 60 + m;
}

function formatTime(totalMin: number): string {
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface FlatEntry {
  key: string;
  time: string;
  saunaIndex: number;
  saunaName: string;
  cell: SchedulePanelCell;
}

function flattenEntries(data: SchedulePanelData): FlatEntry[] {
  const rows: FlatEntry[] = [];
  data.cells.forEach((row, saunaIdx) => {
    row.forEach((cell, slotIdx) => {
      if (!cell) return;
      const time = cell.time ?? data.timeSlots[slotIdx] ?? '';
      if (!time) return;
      rows.push({
        key: `${saunaIdx}-${slotIdx}-${time}`,
        time,
        saunaIndex: saunaIdx,
        saunaName: data.saunas[saunaIdx]?.name ?? '',
        cell,
      });
    });
  });
  return rows.sort((a, b) => parseTime(a.time) - parseTime(b.time));
}

function statusColors(
  cell: SchedulePanelCell,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
) {
  const { colors } = tokens;
  if (cell.isLive) return { color: colors.statusLive, label: 'LÄUFT' };
  if (cell.isPrestart) return { color: colors.statusWarning, label: 'GLEICH' };
  if (cell.isNext) return { color: colors.statusNext, label: 'GLEICH' };
  if (cell.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.7), label: 'VORBEI' };
  return null;
}

function StatusPill({
  label,
  color,
  tokens,
  viewport,
}: {
  label: string;
  color: string;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { typography } = tokens;
  return (
    <span
      className="shrink-0"
      style={{
        color,
        backgroundColor: 'transparent',
        border: `1px solid ${withAlpha(color, 0.55)}`,
        padding: `${scaled(2, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
        borderRadius: 9999,
        fontSize: `${scaledFont(
          typography.baseSizePx * typography.scaleSm * 0.85,
          viewport,
          7,
        )}px`,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        fontWeight: 700,
        lineHeight: 1.3,
        fontFamily: typography.fontBody,
      }}
    >
      {label}
    </span>
  );
}

function IntensityDots({
  level,
  color,
  muted,
  viewport,
}: {
  level: number;
  color: string;
  muted: string;
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const size = scaled(6, viewport, 3);
  return (
    <div
      className="flex items-center shrink-0"
      style={{ gap: scaled(4, viewport, 2) }}
      aria-label={`Intensität ${level} von 4`}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: i <= level ? color : 'transparent',
            border: `1px solid ${i <= level ? color : muted}`,
          }}
        />
      ))}
    </div>
  );
}

// ── Variant: List (chronological) ───────────────────────────────────────────

function ListVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);
  const pad = scaled(spacing.lg, viewport, 8);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(spacing.md, viewport, 6)}px`,
      }}
    >
      <PanelHeader count={entries.length} tokens={tokens} viewport={viewport} />

      {entries.length === 0 ? (
        <EmptyState tokens={tokens} viewport={viewport} />
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <div className="flex flex-col">
            {entries.map((entry, idx) => (
              <ListRow
                key={entry.key}
                entry={entry}
                first={idx === 0}
                tokens={tokens}
                viewport={viewport}
              />
            ))}
          </div>
        </AutoScroll>
      )}
    </div>
  );
}

function ListRow({
  entry,
  first,
  tokens,
  viewport,
}: {
  entry: FlatEntry;
  first: boolean;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  const { cell } = entry;
  const status = statusColors(cell, tokens);
  const isFinished = cell.isFinished;

  const timeColor = cell.isLive
    ? colors.statusLive
    : cell.isPrestart
      ? colors.statusWarning
      : cell.isNext
        ? colors.statusNext
        : isFinished
          ? withAlpha(colors.textSecondary, 0.65)
          : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${withAlpha(colors.border, 0.7)}` : 'none',
        borderBottom: `1px solid ${withAlpha(colors.border, 0.7)}`,
        padding: `${scaled(14, viewport, 6)}px 0`,
        gap: `${scaled(24, viewport, 8)}px`,
        opacity: isFinished ? 0.75 : 1,
      }}
    >
      {/* Time */}
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(
            typography.baseSizePx * typography.scale2xl,
            viewport,
            14,
          )}px`,
          lineHeight: 1,
          letterSpacing: '0.02em',
          minWidth: `${scaled(110, viewport, 60)}px`,
          fontWeight: 500,
        }}
      >
        {entry.time}
      </span>

      {/* Sauna name label */}
      <span
        className="shrink-0 truncate"
        style={{
          ...labelStyles(
            colors.accentPrimary,
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
          ),
          minWidth: `${scaled(180, viewport, 100)}px`,
        }}
      >
        {entry.saunaName}
      </span>

      {/* Title + aromas column */}
      <div
        className="flex flex-1 min-w-0 flex-col"
        style={{ gap: `${scaled(4, viewport, 2)}px` }}
      >
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleXl,
              viewport,
              13,
            )}px`,
            fontWeight: 700,
            letterSpacing: '0.01em',
            lineHeight: 1.1,
          }}
          title={cell.title}
        >
          {cell.title}
        </span>
        {(cell.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={{
              color: withAlpha(colors.textSecondary, 0.95),
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.95,
                viewport,
                9,
              )}px`,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {cell.aromas!.slice(0, 3).map((a) => a.name).join(' · ')}
          </span>
        ) : null}
      </div>

      {/* Duration */}
      {cell.durationMin != null ? (
        <span
          className="shrink-0 tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.9),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            letterSpacing: '0.05em',
            minWidth: `${scaled(60, viewport, 36)}px`,
            textAlign: 'right',
          }}
        >
          {cell.durationMin}′
        </span>
      ) : null}

      {/* Intensity column — fixed width, centered. Empty-but-reserved
          so dots across rows hang from the same vertical line
          regardless of whether the neighbouring status slot is in use. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: `${scaled(72, viewport, 44)}px` }}
      >
        {cell.intensity != null && cell.intensity > 0 ? (
          <IntensityDots
            level={cell.intensity}
            color={cell.isLive ? colors.statusLive : colors.accentPrimary}
            muted={withAlpha(colors.textSecondary, 0.35)}
            viewport={viewport}
          />
        ) : null}
      </div>

      {/* Status column — also fixed width, right-aligned. Keeps its
          slot even when empty to prevent the intensity column from
          drifting into it. */}
      <div
        className="shrink-0 flex items-center justify-end"
        style={{ width: `${scaled(86, viewport, 54)}px` }}
      >
        {status ? (
          <StatusPill
            label={status.label}
            color={status.color}
            tokens={tokens}
            viewport={viewport}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Variant: Matrix (time rows × sauna columns) ─────────────────────────────

function MatrixVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;

  const entries = flattenEntries(data);
  if (data.saunas.length === 0 || entries.length === 0) {
    return <EmptyStandalone tokens={tokens} viewport={viewport} />;
  }

  const startMins = entries.map((e) => parseTime(e.time));
  const endMins = entries.map((e) => parseTime(e.time) + (e.cell.durationMin ?? 15));
  const axisStart = Math.floor(Math.min(...startMins) / 30) * 30;
  const axisEnd = Math.ceil(Math.max(...endMins) / 30) * 30;
  const axis = new Set<number>();
  for (let m = axisStart; m <= axisEnd; m += 30) axis.add(m);
  for (const m of startMins) axis.add(m);
  const times = Array.from(axis).sort((a, b) => a - b).map(formatTime);

  const entryAt = new Map<string, FlatEntry>();
  for (const e of entries) entryAt.set(`${e.saunaIndex}:${e.time}`, e);

  const pad = scaled(spacing.lg, viewport, 8);
  const timeColWidth = scaled(84, viewport, 48);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(spacing.md, viewport, 6)}px`,
      }}
    >
      <PanelHeader count={entries.length} tokens={tokens} viewport={viewport} />

      {/* Column headers */}
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          columnGap: `${scaled(spacing.sm, viewport, 3)}px`,
          borderBottom: `1px solid ${withAlpha(colors.border, 0.85)}`,
          paddingBottom: scaled(10, viewport, 4),
        }}
      >
        <div />
        {data.saunas.map((sauna) => (
          <SaunaColumnHeader
            key={sauna.id}
            sauna={sauna}
            tokens={tokens}
            viewport={viewport}
          />
        ))}
      </div>

      {/* Body */}
      <AutoScroll className="flex-1 min-h-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            rowGap: 0,
            columnGap: `${scaled(spacing.sm, viewport, 3)}px`,
            alignContent: 'start',
          }}
        >
          {times.map((time, rowIdx) => (
            <MatrixRow
              key={time}
              time={time}
              rowIdx={rowIdx}
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

function MatrixRow({
  time,
  rowIdx,
  saunas,
  entryAt,
  tokens,
  viewport,
}: {
  time: string;
  rowIdx: number;
  saunas: SchedulePanelData['saunas'];
  entryAt: Map<string, FlatEntry>;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  const rowBg = rowIdx % 2 === 0 ? 'transparent' : withAlpha(colors.textPrimary, 0.025);

  return (
    <>
      <div
        className="tabular-nums"
        style={{
          color: withAlpha(colors.textSecondary, 0.9),
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
          padding: `${scaled(12, viewport, 5)}px ${scaled(10, viewport, 4)}px`,
          borderBottom: `1px solid ${withAlpha(colors.border, 0.5)}`,
          backgroundColor: rowBg,
          letterSpacing: '0.02em',
        }}
      >
        {time}
      </div>
      {saunas.map((sauna, saunaIdx) => {
        const entry = sauna.outOfOrder ? null : entryAt.get(`${saunaIdx}:${time}`);
        return (
          <div
            key={`${time}-${sauna.id}`}
            style={{
              backgroundColor: rowBg,
              borderBottom: `1px solid ${withAlpha(colors.border, 0.5)}`,
              padding: `${scaled(10, viewport, 4)}px ${scaled(12, viewport, 5)}px`,
              minHeight: scaled(46, viewport, 26),
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {entry ? (
              <MatrixCell entry={entry} tokens={tokens} viewport={viewport} />
            ) : (
              <span
                style={{
                  color: withAlpha(colors.textSecondary, 0.3),
                  fontFamily: typography.fontMono,
                  fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                }}
              >
                —
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function MatrixCell({
  entry,
  tokens,
  viewport,
}: {
  entry: FlatEntry;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  const { cell } = entry;
  const status = statusColors(cell, tokens);
  const isFinished = cell.isFinished;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex flex-col min-w-0 flex-1"
      style={{ gap: scaled(3, viewport, 1) }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: scaled(6, viewport, 2) }}
      >
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          title={cell.title}
        >
          {cell.title}
        </span>
        {status ? (
          <span
            className="shrink-0"
            style={{
              color: status.color,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.8,
                viewport,
                7,
              )}px`,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {status.label}
          </span>
        ) : null}
      </div>
      {(cell.aromas?.length ?? 0) > 0 ? (
        <span
          className="truncate"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleSm * 0.85,
              viewport,
              8,
            )}px`,
            letterSpacing: '0.06em',
          }}
        >
          {cell.aromas!.slice(0, 2).map((a) => a.name).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

// ── Variant: Timeline (stretched rows) ──────────────────────────────────────

function TimelineVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;

  const entries = flattenEntries(data);
  if (data.saunas.length === 0 || entries.length === 0) {
    return <EmptyStandalone tokens={tokens} viewport={viewport} />;
  }

  const startMins = entries.map((e) => parseTime(e.time));
  const endMins = entries.map((e) => parseTime(e.time) + (e.cell.durationMin ?? 15));
  const axisStart = Math.floor(Math.min(...startMins) / 30) * 30;
  const axisEnd = Math.ceil(Math.max(...endMins) / 30) * 30;
  const axis = new Set<number>();
  for (let m = axisStart; m <= axisEnd; m += 30) axis.add(m);
  for (const m of startMins) axis.add(m);
  const times = Array.from(axis).sort((a, b) => a - b).map(formatTime);

  const entryAt = new Map<string, FlatEntry>();
  for (const e of entries) entryAt.set(`${e.saunaIndex}:${e.time}`, e);

  const pad = scaled(spacing.lg, viewport, 8);
  const timeColWidth = scaled(84, viewport, 48);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;
  const minRow = scaled(52, viewport, 30);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(spacing.md, viewport, 6)}px`,
      }}
    >
      <PanelHeader count={entries.length} tokens={tokens} viewport={viewport} />

      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          columnGap: `${scaled(spacing.sm, viewport, 3)}px`,
          paddingBottom: scaled(10, viewport, 4),
          borderBottom: `1px solid ${withAlpha(colors.border, 0.85)}`,
        }}
      >
        <div />
        {data.saunas.map((sauna) => (
          <SaunaColumnHeader
            key={sauna.id}
            sauna={sauna}
            tokens={tokens}
            viewport={viewport}
          />
        ))}
      </div>

      <AutoScroll className="flex-1 min-h-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            gridTemplateRows: `repeat(${times.length}, minmax(${minRow}px, 1fr))`,
            columnGap: `${scaled(spacing.sm, viewport, 3)}px`,
            rowGap: 0,
            minHeight: '100%',
          }}
        >
          {times.map((time) => (
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
  entryAt: Map<string, FlatEntry>;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;

  return (
    <>
      <div
        className="flex items-center justify-end tabular-nums h-full"
        style={{
          color: withAlpha(colors.textSecondary, 0.9),
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
          padding: `0 ${scaled(12, viewport, 5)}px`,
          borderBottom: `1px solid ${withAlpha(colors.border, 0.35)}`,
          letterSpacing: '0.02em',
        }}
      >
        {time}
      </div>
      {saunas.map((sauna, saunaIdx) => {
        const entry = sauna.outOfOrder ? null : entryAt.get(`${saunaIdx}:${time}`);
        return (
          <div
            key={`${time}-${sauna.id}`}
            className="flex items-center h-full"
            style={{
              padding: `${scaled(6, viewport, 2)}px ${scaled(10, viewport, 4)}px`,
              borderBottom: `1px solid ${withAlpha(colors.border, 0.35)}`,
            }}
          >
            {entry ? (
              <TimelineCell entry={entry} tokens={tokens} viewport={viewport} />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function TimelineCell({
  entry,
  tokens,
  viewport,
}: {
  entry: FlatEntry;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  const { cell } = entry;
  const status = statusColors(cell, tokens);
  const isFinished = cell.isFinished;

  const leftBar = cell.isLive
    ? colors.statusLive
    : cell.isPrestart
      ? colors.statusWarning
      : cell.isNext
        ? colors.statusNext
        : colors.accentPrimary;

  return (
    <div
      className="flex w-full items-center h-full"
      style={{
        borderLeft: `2px solid ${leftBar}`,
        paddingLeft: scaled(10, viewport, 4),
        gap: scaled(10, viewport, 4),
        opacity: isFinished ? 0.65 : 1,
      }}
    >
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ gap: scaled(2, viewport, 1) }}
      >
        <span
          className="truncate"
          style={{
            color: isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          title={cell.title}
        >
          {cell.title}
        </span>
        {cell.durationMin != null ? (
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.85,
                viewport,
                8,
              )}px`,
              letterSpacing: '0.04em',
            }}
          >
            {cell.durationMin}′
          </span>
        ) : null}
      </div>
      {status ? (
        <span
          className="shrink-0"
          style={{
            color: status.color,
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleSm * 0.75,
              viewport,
              7,
            )}px`,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          {status.label}
        </span>
      ) : null}
    </div>
  );
}

// ── Shared chrome ───────────────────────────────────────────────────────────

function SaunaColumnHeader({
  sauna,
  tokens,
  viewport,
}: {
  sauna: SchedulePanelData['saunas'][number];
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex items-baseline justify-between"
      style={{ gap: scaled(6, viewport, 2) }}
    >
      <span
        className="truncate"
        style={labelStyles(
          sauna.outOfOrder
            ? withAlpha(colors.textSecondary, 0.5)
            : colors.accentPrimary,
          scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
        )}
        title={sauna.name}
      >
        {sauna.name}
      </span>
      {!sauna.outOfOrder && typeof sauna.temperatureC === 'number' ? (
        <span
          className="shrink-0 tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleSm * 0.85,
              viewport,
              8,
            )}px`,
          }}
        >
          {sauna.temperatureC}°
        </span>
      ) : sauna.outOfOrder ? (
        <span
          style={{
            color: withAlpha(colors.textSecondary, 0.5),
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scaleSm * 0.75,
              viewport,
              7,
            )}px`,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          außer betrieb
        </span>
      ) : null}
    </div>
  );
}

function PanelHeader({
  count,
  tokens,
  viewport,
}: {
  count: number;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex items-baseline justify-between shrink-0"
      style={{ paddingBottom: scaled(2, viewport, 1) }}
    >
      <span
        style={labelStyles(
          colors.accentPrimary,
          scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
        )}
      >
        Aufgussplan
      </span>
      <span
        className="tabular-nums"
        style={{
          color: withAlpha(colors.textSecondary, 0.85),
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
          letterSpacing: '0.1em',
        }}
      >
        {count.toString().padStart(2, '0')} Einträge
      </span>
    </div>
  );
}

function EmptyState({
  tokens,
  viewport,
}: {
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex flex-1 items-center justify-center"
      style={{
        color: withAlpha(colors.textSecondary, 0.8),
        fontFamily: typography.fontBody,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      Heute keine Aufgüsse geplant
    </div>
  );
}

function EmptyStandalone({
  tokens,
  viewport,
}: {
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors } = tokens;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
    >
      <EmptyState tokens={tokens} viewport={viewport} />
    </div>
  );
}
