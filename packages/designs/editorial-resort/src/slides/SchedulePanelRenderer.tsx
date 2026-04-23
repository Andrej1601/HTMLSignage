import type {
  IntensityDisplay,
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelStyle,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  IntensityMark,
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Editorial Resort — content-panel dispatcher.
 *
 * Three variants share the magazine vocabulary (serif display heads,
 * small-caps kickers, hairline rules, generous rhythm). They differ in
 * how they arrange the feed:
 *   - list     — editorial itinerary (one row per entry)
 *   - matrix   — schedule table with kicker column heads
 *   - timeline — stretched event rows with serif titles
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

function statusMeta(
  cell: SchedulePanelCell,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
) {
  const { colors } = tokens;
  if (cell.isLive) return { color: colors.statusLive, label: 'Läuft' };
  if (cell.isPrestart) return { color: colors.statusWarning, label: 'Gleich' };
  if (cell.isNext) return { color: colors.statusNext, label: 'Gleich' };
  if (cell.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.75), label: 'Vorbei' };
  return null;
}

/**
 * Local wrapper around the shared `IntensityMark` that adapts the
 * flame/Roman choice to the host's `intensityDisplay` preference and
 * dims the colour for finished entries.
 */
function ScheduleIntensityMark({
  level,
  activeColor,
  idleColor,
  viewport,
  tokens,
  intensityDisplay,
}: {
  level: number;
  activeColor: string;
  idleColor: string;
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  intensityDisplay: IntensityDisplay;
}) {
  const { typography } = tokens;
  const size = scaled(22, viewport, 14);
  return (
    <IntensityMark
      level={level}
      color={activeColor}
      idleColor={idleColor}
      size={size}
      display={intensityDisplay}
      fontFamily={typography.fontMono}
    />
  );
}

function StatusWord({
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
        fontFamily: typography.fontHeading,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
        fontStyle: 'italic',
        letterSpacing: '0.03em',
        fontWeight: 400,
      }}
    >
      {label}
    </span>
  );
}

// ── Variant: List (editorial itinerary) ─────────────────────────────────────

function ListVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);
  const pad = scaled(spacing.xl, viewport, 10);
  const intensityDisplay = context.intensityDisplay ?? 'flames';

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 6),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />

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
                intensityDisplay={intensityDisplay}
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
  intensityDisplay,
}: {
  entry: FlatEntry;
  first: boolean;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
  intensityDisplay: IntensityDisplay;
}) {
  const { colors, typography } = tokens;
  const { cell } = entry;
  const status = statusMeta(cell, tokens);
  const isFinished = cell.isFinished;

  const timeColor = cell.isLive
    ? colors.statusLive
    : cell.isPrestart
      ? colors.statusWarning
      : cell.isNext
        ? colors.statusNext
        : isFinished
          ? withAlpha(colors.textSecondary, 0.7)
          : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${colors.border}` : 'none',
        borderBottom: `1px solid ${colors.border}`,
        padding: `${scaled(20, viewport, 8)}px 0`,
        gap: `${scaled(32, viewport, 10)}px`,
        opacity: isFinished ? 0.78 : 1,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 20)}px`,
          fontWeight: 500,
          lineHeight: 0.95,
          letterSpacing: '-0.01em',
          minWidth: `${scaled(140, viewport, 80)}px`,
        }}
      >
        {entry.time}
      </span>

      <div
        className="flex flex-1 min-w-0 flex-col"
        style={{ gap: `${scaled(6, viewport, 2)}px` }}
      >
        <span
          className="truncate"
          style={kickerStyles(
            colors.accentPrimary,
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
          )}
        >
          {entry.saunaName}
          {cell.durationMin != null ? ` · ${cell.durationMin} Minuten` : ''}
        </span>
        <h3
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 16)}px`,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            lineHeight: 1.15,
            margin: 0,
          }}
          title={cell.title}
        >
          {cell.title}
        </h3>
        {(cell.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.95),
              scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11),
              typography.fontHeading,
            )}
          >
            mit {cell.aromas!.slice(0, 3).map((a) => a.name).join(', ')}
          </span>
        ) : null}
      </div>

      {cell.intensity != null && cell.intensity > 0 ? (
        <ScheduleIntensityMark
          level={cell.intensity}
          activeColor={
            isFinished
              ? withAlpha(colors.accentPrimary, 0.45)
              : cell.isLive
                ? colors.statusLive
                : colors.accentPrimary
          }
          idleColor={withAlpha(colors.accentPrimary, 0.2)}
          tokens={tokens}
          viewport={viewport}
          intensityDisplay={intensityDisplay}
        />
      ) : null}

      <div
        className="shrink-0"
        style={{ minWidth: `${scaled(86, viewport, 54)}px`, textAlign: 'right' }}
      >
        {status ? (
          <StatusWord
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

// ── Variant: Matrix ─────────────────────────────────────────────────────────

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

  const pad = scaled(spacing.xl, viewport, 10);
  const timeColWidth = scaled(96, viewport, 54);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 6),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />

      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          columnGap: `${scaled(spacing.md, viewport, 6)}px`,
          borderBottom: `1px solid ${colors.border}`,
          paddingBottom: scaled(12, viewport, 5),
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
            columnGap: `${scaled(spacing.md, viewport, 6)}px`,
            rowGap: 0,
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
  const rowBg = rowIdx % 2 === 0 ? 'transparent' : withAlpha(colors.accentPrimary, 0.04);

  return (
    <>
      <div
        className="tabular-nums"
        style={{
          color: colors.textSecondary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
          fontWeight: 500,
          padding: `${scaled(14, viewport, 6)}px ${scaled(12, viewport, 5)}px`,
          borderBottom: `1px solid ${withAlpha(colors.border, 0.75)}`,
          backgroundColor: rowBg,
          letterSpacing: '-0.005em',
          lineHeight: 1,
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
              borderBottom: `1px solid ${withAlpha(colors.border, 0.75)}`,
              padding: `${scaled(12, viewport, 5)}px ${scaled(14, viewport, 6)}px`,
              minHeight: scaled(54, viewport, 32),
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {entry ? (
              <MatrixCell entry={entry} tokens={tokens} viewport={viewport} />
            ) : (
              <span
                style={{
                  color: withAlpha(colors.textSecondary, 0.35),
                  fontFamily: typography.fontHeading,
                  fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
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
  const status = statusMeta(cell, tokens);
  const isFinished = cell.isFinished;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex flex-col min-w-0 flex-1"
      style={{ gap: scaled(4, viewport, 1) }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: scaled(8, viewport, 3) }}
      >
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            lineHeight: 1.1,
          }}
          title={cell.title}
        >
          {cell.title}
        </span>
        {status ? (
          <StatusWord
            label={status.label}
            color={status.color}
            tokens={tokens}
            viewport={viewport}
          />
        ) : null}
      </div>
      {(cell.aromas?.length ?? 0) > 0 ? (
        <span
          className="truncate"
          style={eyebrowStyles(
            withAlpha(colors.textSecondary, 0.9),
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
            typography.fontHeading,
          )}
        >
          mit {cell.aromas!.slice(0, 2).map((a) => a.name).join(', ')}
        </span>
      ) : null}
    </div>
  );
}

// ── Variant: Timeline ───────────────────────────────────────────────────────

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

  const pad = scaled(spacing.xl, viewport, 10);
  const timeColWidth = scaled(96, viewport, 54);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;
  const minRow = scaled(56, viewport, 32);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 6),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />

      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          columnGap: `${scaled(spacing.md, viewport, 6)}px`,
          paddingBottom: scaled(12, viewport, 5),
          borderBottom: `1px solid ${colors.border}`,
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
            columnGap: `${scaled(spacing.md, viewport, 6)}px`,
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
          color: colors.textSecondary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
          fontWeight: 500,
          padding: `0 ${scaled(14, viewport, 6)}px`,
          borderBottom: `1px solid ${withAlpha(colors.border, 0.6)}`,
          letterSpacing: '-0.005em',
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
              padding: `${scaled(8, viewport, 3)}px ${scaled(12, viewport, 5)}px`,
              borderBottom: `1px solid ${withAlpha(colors.border, 0.6)}`,
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
  const status = statusMeta(cell, tokens);
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
        paddingLeft: scaled(12, viewport, 5),
        gap: scaled(12, viewport, 4),
        opacity: isFinished ? 0.68 : 1,
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            fontWeight: 600,
            letterSpacing: '-0.005em',
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
                typography.baseSizePx * typography.scaleSm * 0.9,
                viewport,
                8,
              )}px`,
              letterSpacing: '0.04em',
            }}
          >
            {cell.durationMin} Min
          </span>
        ) : null}
      </div>
      {status ? (
        <StatusWord label={status.label} color={status.color} tokens={tokens} viewport={viewport} />
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
        style={kickerStyles(
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
            color: colors.textSecondary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
            fontWeight: 500,
          }}
        >
          {sauna.temperatureC}°
        </span>
      ) : sauna.outOfOrder ? (
        <span
          style={eyebrowStyles(
            withAlpha(colors.textSecondary, 0.55),
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8),
            typography.fontHeading,
          )}
        >
          außer Betrieb
        </span>
      ) : null}
    </div>
  );
}

function Masthead({
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
      className="flex items-end justify-between shrink-0"
      style={{
        paddingBottom: scaled(16, viewport, 6),
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
        <span
          style={kickerStyles(
            colors.accentPrimary,
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
          )}
        >
          Aus der Saunawelt
        </span>
        <h1
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 18)}px`,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            lineHeight: 1,
            margin: 0,
          }}
        >
          Aufgussplan
        </h1>
      </div>
      <span
        className="tabular-nums"
        style={{
          color: withAlpha(colors.textSecondary, 0.85),
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}
      >
        {count} {count === 1 ? 'Eintrag' : 'Einträge'}
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
        color: withAlpha(colors.textSecondary, 0.85),
        fontFamily: typography.fontHeading,
        fontStyle: 'italic',
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
      }}
    >
      Heute keine Aufgüsse geplant.
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
