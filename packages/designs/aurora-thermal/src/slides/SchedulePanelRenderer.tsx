import type {
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelStyle,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
  romanNumeral,
  scaled,
  scaledFont,
  statusChipStyles,
  withAlpha,
} from './utils';

type Tokens = SlideRendererProps<'content-panel'>['tokens'];
type Viewport = SlideRendererProps<'content-panel'>['context']['viewport'];

/**
 * Aurora Thermal — content-panel dispatcher.
 *
 * Three variants share the warm-charcoal stage and brass vocabulary:
 *   - list     — chronological "playbill for the evening"
 *   - matrix   — saunas-as-columns grid, each cell is a brass card
 *   - timeline — saunas-as-rows, proportional time axis with glowing
 *                now-line. This is the one that turns heads.
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

// ── Shared helpers ─────────────────────────────────────────────────────────

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
  minutes: number;
  saunaIndex: number;
  saunaName: string;
  saunaColor?: string;
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
        minutes: parseTime(time),
        saunaIndex: saunaIdx,
        saunaName: data.saunas[saunaIdx]?.name ?? '',
        saunaColor: data.saunas[saunaIdx]?.color,
        cell,
      });
    });
  });
  return rows.sort((a, b) => a.minutes - b.minutes);
}

function statusMeta(cell: SchedulePanelCell, tokens: Tokens) {
  const { colors } = tokens;
  if (cell.isLive) return { color: colors.statusLive, label: 'Jetzt' };
  if (cell.isPrestart) return { color: colors.statusWarning, label: 'Gleich' };
  if (cell.isNext) return { color: colors.statusNext, label: 'Als Nächstes' };
  if (cell.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.6), label: 'Beendet' };
  return null;
}

/**
 * Intensity mark — Roman numerals in a brass hairline ring.
 * Keeps flames off the screen while reading at distance.
 */
function IntensityMark({
  level,
  color,
  viewport,
  tokens,
}: {
  level: number;
  color: string;
  viewport: Viewport;
  tokens: Tokens;
}) {
  const { typography } = tokens;
  const size = scaled(26, viewport, 16);
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center tabular-nums"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1px solid ${withAlpha(color, 0.65)}`,
        color,
        fontFamily: typography.fontMono,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9)}px`,
        fontWeight: 600,
        letterSpacing: '0.02em',
        backgroundColor: withAlpha(color, 0.08),
      }}
      aria-label={`Intensität ${level} von 4`}
    >
      {romanNumeral(level)}
    </span>
  );
}

/**
 * Small brass status chip. Subtle inner glow when live.
 */
function StatusChip({
  cell,
  tokens,
  viewport,
}: {
  cell: SchedulePanelCell;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const status = statusMeta(cell, tokens);
  if (!status) return null;
  const { typography } = tokens;
  const size = scaledFont(typography.baseSizePx * typography.scaleSm * 0.88, viewport, 9);
  return (
    <span style={statusChipStyles(status.color, { isLive: cell.isLive, sizePx: size, fontFamily: typography.fontBody })}>
      {cell.isLive ? (
        <span
          aria-hidden
          style={{
            width: Math.round(size * 0.55),
            height: Math.round(size * 0.55),
            borderRadius: '50%',
            backgroundColor: status.color,
            boxShadow: `0 0 ${Math.round(size * 0.9)}px ${withAlpha(status.color, 0.9)}`,
          }}
        />
      ) : null}
      {status.label}
    </span>
  );
}

// ── Common masthead ────────────────────────────────────────────────────────

function Masthead({
  count,
  subtitle,
  tokens,
  viewport,
}: {
  count: number;
  subtitle?: string;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography } = tokens;
  // Compact one-liner: title on the left, "heute · N Aufgüsse" on the
  // right. The old "SAUNAWELT · HEUTE" kicker was redundant with the
  // display header; the title also dropped a notch (scale3xl*1.05
  // was ~50px → scale2xl*1.1 ≈ 37px) so the list wins ~40px of
  // vertical headroom per slide.
  return (
    <div
      className="flex shrink-0 items-baseline justify-between"
      style={{ gap: scaled(20, viewport, 6), paddingBottom: scaled(2, viewport, 1) }}
    >
      <h1
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.1, viewport, 18)}px`,
          fontWeight: 500,
          letterSpacing: '-0.015em',
          lineHeight: 1,
          margin: 0,
        }}
      >
        Aufguss-Ritual
      </h1>

      <div
        className="flex items-baseline shrink-0"
        style={{ gap: scaled(10, viewport, 3) }}
      >
        {subtitle ? (
          <span
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.9),
              scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10),
              typography.fontHeading,
            )}
          >
            {subtitle}
          </span>
        ) : null}
        <span
          className="tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.9),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            letterSpacing: '0.04em',
            fontWeight: 500,
            textTransform: 'uppercase',
          }}
        >
          heute · {count} {count === 1 ? 'Aufguss' : 'Aufgüsse'}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ tokens, viewport }: { tokens: Tokens; viewport: Viewport }) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center"
      style={{ gap: scaled(16, viewport, 6), padding: scaled(32, viewport, 10) }}
    >
      <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 48) }} />
      <span
        style={{
          color: withAlpha(colors.textSecondary, 0.9),
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 14)}px`,
          fontStyle: 'italic',
          fontWeight: 400,
          textAlign: 'center',
        }}
      >
        Heute kein Aufguss-Plan hinterlegt.
      </span>
      <span
        style={eyebrowStyles(
          withAlpha(colors.textSecondary, 0.7),
          scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10),
          typography.fontBody,
        )}
      >
        Wir freuen uns dennoch auf Ihren Besuch.
      </span>
    </div>
  );
}

// ── Variant: List (chronological playbill) ─────────────────────────────────

function ListVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);
  const pad = scaled(spacing.lg, viewport, 12);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacing.md, viewport, 8),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />
      <div style={brassHairline(colors, 1)} />

      {entries.length === 0 ? (
        <EmptyState tokens={tokens} viewport={viewport} />
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <div className="flex flex-col" style={{ paddingTop: scaled(12, viewport, 4) }}>
            {entries.map((entry) => (
              <ListRow
                key={entry.key}
                entry={entry}
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
  tokens,
  viewport,
}: {
  entry: FlatEntry;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography } = tokens;
  const { cell } = entry;
  const isFinished = !!cell.isFinished;

  const timeColor = cell.isLive
    ? colors.statusLive
    : cell.isPrestart
      ? colors.statusWarning
      : cell.isNext
        ? colors.statusNext
        : isFinished
          ? withAlpha(colors.textSecondary, 0.55)
          : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.5)
    : colors.textPrimary;

  const aromaList = (cell.aromas ?? []).slice(0, 4);

  return (
    <div
      className="flex items-center"
      style={{
        borderBottom: `1px solid ${withAlpha(colors.border, 0.55)}`,
        // Tighter rows so more time slots fit on a typical 1080p
        // schedule screen. Was 22/0 → felt airy but only 6–7 rows
        // were visible at once on wellness-stage layouts.
        padding: `${scaled(14, viewport, 6)}px 0`,
        gap: `${scaled(28, viewport, 10)}px`,
        opacity: isFinished ? 0.75 : 1,
        position: 'relative',
      }}
    >
      {/* Sauna-colour leading stripe: subtle but makes rows scannable
          when the user is quickly looking for "their" sauna. */}
      {entry.saunaColor ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: -scaled(spacing(viewport, 'sm'), viewport, 4),
            top: scaled(18, viewport, 6),
            bottom: scaled(18, viewport, 6),
            width: 2,
            backgroundColor: withAlpha(entry.saunaColor, isFinished ? 0.35 : 0.85),
            borderRadius: 1,
          }}
        />
      ) : null}

      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontHeading,
          // Smaller than scale3xl × 0.95 so the time column doesn't
          // eat the track when an entry's title is long.
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.1, viewport, 20)}px`,
          fontWeight: 400,
          lineHeight: 0.95,
          letterSpacing: '-0.015em',
          minWidth: `${scaled(120, viewport, 72)}px`,
          textShadow: cell.isLive
            ? `0 0 24px ${withAlpha(colors.statusLive, 0.35)}`
            : undefined,
        }}
      >
        {entry.time}
      </span>

      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(4, viewport, 1) }}>
        <span
          className="truncate"
          style={kickerStyles(
            entry.saunaColor
              ? withAlpha(entry.saunaColor, isFinished ? 0.6 : 1)
              : colors.accentPrimary,
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9),
          )}
        >
          {entry.saunaName}
          {cell.durationMin != null ? ` · ${cell.durationMin} Min` : ''}
        </span>
        <h3
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl * 1.1, viewport, 14)}px`,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
            margin: 0,
          }}
          title={cell.title}
        >
          {cell.title}
        </h3>
        {aromaList.length > 0 ? (
          <div
            className="flex flex-wrap items-center"
            style={{ gap: `${scaled(6, viewport, 2)}px ${scaled(8, viewport, 3)}px`, marginTop: scaled(3, viewport, 1) }}
          >
            {aromaList.map((aroma) => {
              const aromaColor = aroma.color || withAlpha(colors.accentSecondary, 0.9);
              return (
                <span
                  key={aroma.id}
                  className="inline-flex items-center"
                  style={{
                    gap: scaled(5, viewport, 2),
                    padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
                    borderRadius: 9999,
                    backgroundColor: withAlpha(aromaColor, isFinished ? 0.08 : 0.18),
                    border: `1px solid ${withAlpha(aromaColor, isFinished ? 0.35 : 0.7)}`,
                    // Text is always ivory (textPrimary), never the aroma
                    // colour — the previous green-on-green-tinted-background
                    // dropped below WCAG legibility for darker aromas.
                    // Aroma identity is carried by the border + subtle bg
                    // tint + emoji.
                    color: isFinished
                      ? withAlpha(colors.textPrimary, 0.6)
                      : colors.textPrimary,
                    fontFamily: typography.fontBody,
                    fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.92, viewport, 8)}px`,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {aroma.emoji ? <span aria-hidden>{aroma.emoji}</span> : null}
                  <span>{aroma.name}</span>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Right column: intensity + status share a single fixed-width
          container with right-aligned content. This guarantees the
          intensity pill stays in its visual column regardless of
          whether the status chip is present (previously an empty
          `minWidth` div could collapse, leaving intensity floating at
          the far right edge). */}
      <div
        className="shrink-0 flex items-center justify-end"
        style={{
          minWidth: scaled(150, viewport, 84),
          gap: scaled(10, viewport, 4),
        }}
      >
        {cell.intensity != null && cell.intensity > 0 ? (
          <IntensityMark
            level={cell.intensity}
            color={
              isFinished
                ? withAlpha(colors.accentPrimary, 0.4)
                : cell.isLive
                  ? colors.statusLive
                  : colors.accentPrimary
            }
            tokens={tokens}
            viewport={viewport}
          />
        ) : null}
        <StatusChip cell={cell} tokens={tokens} viewport={viewport} />
      </div>
    </div>
  );
}

// Utility: resolve a spacing token by name (lets us scale spacing tokens
// without hard-coding numbers inside ListRow). Falls back to md.
function spacing(viewport: Viewport, key: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): number {
  const base = { xs: 4, sm: 12, md: 24, lg: 40, xl: 64 };
  const abs = base[key] ?? base.md;
  if (viewport.isUltraCompact) return Math.max(2, Math.round(abs * 0.5));
  if (viewport.isCompact) return Math.max(4, Math.round(abs * 0.65));
  return abs;
}

// ── Variant: Matrix (sauna columns × time rows) ────────────────────────────

function MatrixVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing: spacingTokens } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);

  if (data.saunas.length === 0 || entries.length === 0) {
    return (
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        style={{
          background: auroraAmbientBackground(colors),
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
          padding: `${scaled(spacingTokens.lg, viewport, 12)}px`,
          gap: scaled(spacingTokens.md, viewport, 8),
        }}
      >
        <Masthead count={0} tokens={tokens} viewport={viewport} />
        <div style={brassHairline(colors, 1)} />
        <EmptyState tokens={tokens} viewport={viewport} />
      </div>
    );
  }

  // Build unique time axis from the start times, then cluster into
  // 15-minute buckets so adjacent slots don't fragment visually.
  const bucketMinutes = 30;
  const startMins = entries.map((e) => e.minutes);
  const axisStart = Math.floor(Math.min(...startMins) / bucketMinutes) * bucketMinutes;
  const axisEnd = Math.ceil(Math.max(...startMins) / bucketMinutes) * bucketMinutes + bucketMinutes;
  const buckets: number[] = [];
  for (let m = axisStart; m <= axisEnd; m += bucketMinutes) buckets.push(m);

  // Group entries by (sauna, bucket).
  const entryAt = new Map<string, FlatEntry[]>();
  for (const e of entries) {
    const bucket = axisStart + Math.floor((e.minutes - axisStart) / bucketMinutes) * bucketMinutes;
    const key = `${e.saunaIndex}:${bucket}`;
    const list = entryAt.get(key) ?? [];
    list.push(e);
    entryAt.set(key, list);
  }

  const pad = scaled(spacingTokens.lg, viewport, 12);
  const timeColWidth = scaled(92, viewport, 52);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacingTokens.md, viewport, 8),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />
      <div style={brassHairline(colors, 1)} />

      {/* Column heads */}
      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns,
          columnGap: scaled(spacingTokens.sm, viewport, 4),
          paddingBottom: scaled(6, viewport, 2),
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
            columnGap: scaled(spacingTokens.sm, viewport, 4),
            rowGap: scaled(spacingTokens.sm, viewport, 4),
          }}
        >
          {buckets.map((bucket) => {
            const timeLabel = formatTime(bucket);
            return (
              <MatrixBucketRow
                key={bucket}
                timeLabel={timeLabel}
                bucket={bucket}
                entryAt={entryAt}
                saunaCount={data.saunas.length}
                tokens={tokens}
                viewport={viewport}
              />
            );
          })}
        </div>
      </AutoScroll>
    </div>
  );
}

function SaunaColumnHeader({
  sauna,
  tokens,
  viewport,
}: {
  sauna: SchedulePanelData['saunas'][number];
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography } = tokens;
  const accent = sauna.color || colors.accentPrimary;
  return (
    <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
      <div
        style={{
          height: 2,
          width: scaled(36, viewport, 18),
          backgroundColor: withAlpha(accent, 0.9),
          borderRadius: 1,
        }}
      />
      <span
        className="truncate"
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          lineHeight: 1.1,
        }}
        title={sauna.name}
      >
        {sauna.name}
      </span>
      {sauna.temperatureC != null ? (
        <span
          className="tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9)}px`,
            letterSpacing: '0.02em',
          }}
        >
          {Math.round(sauna.temperatureC)} °C
        </span>
      ) : null}
      {sauna.outOfOrder ? (
        <span
          style={{
            color: withAlpha(colors.statusWarning, 0.9),
            fontFamily: typography.fontBody,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
          }}
        >
          Außer Betrieb
        </span>
      ) : null}
    </div>
  );
}

function MatrixBucketRow({
  timeLabel,
  bucket,
  entryAt,
  saunaCount,
  tokens,
  viewport,
}: {
  timeLabel: string;
  bucket: number;
  entryAt: Map<string, FlatEntry[]>;
  saunaCount: number;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography } = tokens;
  return (
    <>
      <div className="flex items-start tabular-nums" style={{ paddingTop: scaled(8, viewport, 3) }}>
        <span
          style={{
            color: withAlpha(colors.textSecondary, 0.95),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            letterSpacing: '0.04em',
            fontWeight: 500,
          }}
        >
          {timeLabel}
        </span>
      </div>
      {Array.from({ length: saunaCount }).map((_, saunaIdx) => {
        const cellKey = `${saunaIdx}:${bucket}`;
        const items = entryAt.get(cellKey) ?? [];
        return (
          <div
            key={cellKey}
            className="flex flex-col"
            style={{ gap: scaled(6, viewport, 2), minHeight: scaled(56, viewport, 24) }}
          >
            {items.map((entry) => (
              <MatrixCell
                key={entry.key}
                entry={entry}
                tokens={tokens}
                viewport={viewport}
              />
            ))}
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
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography, radius } = tokens;
  const { cell } = entry;
  const isFinished = !!cell.isFinished;
  const accent = entry.saunaColor || colors.accentPrimary;

  const borderColor = cell.isLive
    ? withAlpha(colors.statusLive, 0.7)
    : cell.isPrestart
      ? withAlpha(colors.statusWarning, 0.6)
      : cell.isNext
        ? withAlpha(colors.statusNext, 0.55)
        : withAlpha(colors.border, 0.85);

  return (
    <div
      style={{
        padding: `${scaled(10, viewport, 4)}px ${scaled(14, viewport, 5)}px`,
        borderRadius: radius.md,
        border: `1px solid ${borderColor}`,
        backgroundColor: cell.isLive
          ? withAlpha(colors.statusLive, 0.1)
          : withAlpha(colors.surfaceElevated, 0.85),
        boxShadow: cell.isLive
          ? `0 0 20px ${withAlpha(colors.statusLive, 0.18)}`
          : `0 1px 0 ${withAlpha(colors.accentPrimary, 0.04)}`,
        opacity: isFinished ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: scaled(4, viewport, 1),
      }}
    >
      <div className="flex items-center" style={{ gap: scaled(8, viewport, 3) }}>
        <span
          className="tabular-nums"
          style={{
            color: cell.isLive
              ? colors.statusLive
              : isFinished
                ? withAlpha(colors.textSecondary, 0.7)
                : accent,
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
            fontWeight: 600,
            letterSpacing: '0.02em',
            lineHeight: 1,
          }}
        >
          {entry.time}
        </span>
        {cell.intensity != null && cell.intensity > 0 ? (
          <IntensityMark
            level={cell.intensity}
            color={cell.isLive ? colors.statusLive : accent}
            tokens={tokens}
            viewport={viewport}
          />
        ) : null}
      </div>
      <span
        className="line-clamp-2"
        style={{
          color: isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          fontWeight: 500,
          lineHeight: 1.2,
          letterSpacing: '-0.005em',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
        }}
        title={cell.title}
      >
        {cell.title}
      </span>
      {cell.aromas && cell.aromas.length > 0 ? (
        <span
          className="truncate"
          style={{
            color: withAlpha(colors.textSecondary, 0.9),
            fontFamily: typography.fontBody,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 8)}px`,
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          {cell.aromas.map((a) => (a.emoji ? `${a.emoji} ${a.name}` : a.name)).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}


// ── Variant: Timeline (saunas as rows, fixed-width time axis + h-scroll) ───
//
// The timeline reads like a thermal bath's daily programme poster:
//   - Each 30-min slot gets a fixed pixel width so entry cards have
//     room for the full title inside the tile (no outside overflow).
//   - The combined track is typically wider than the screen; we wrap
//     it in a horizontal `AutoScroll` so the display cycles through
//     the full day without an operator touching it.
//   - A brass "JETZT"-banner pinned to the now-line keeps the live
//     moment visible even when the auto-scroll drifts past it.

function TimelineVariant({ data, tokens, context }: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing: spacingTokens, radius } = tokens;
  const { viewport } = context;
  const entries = flattenEntries(data);

  if (data.saunas.length === 0 || entries.length === 0) {
    return (
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        style={{
          background: auroraAmbientBackground(colors),
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
          padding: `${scaled(spacingTokens.lg, viewport, 12)}px`,
          gap: scaled(spacingTokens.md, viewport, 8),
        }}
      >
        <Masthead count={0} tokens={tokens} viewport={viewport} />
        <div style={brassHairline(colors, 1)} />
        <EmptyState tokens={tokens} viewport={viewport} />
      </div>
    );
  }

  // Time axis: half-hour ticks from first-entry-start rounded down to
  // last-entry-end rounded up. At least 2h of axis so a single short
  // aufguss still renders a legible bar.
  const startMinsList = entries.map((e) => e.minutes);
  const endMinsList = entries.map((e) => e.minutes + (e.cell.durationMin ?? 15));
  const axisStart = Math.floor(Math.min(...startMinsList) / 30) * 30;
  const axisEnd = Math.max(axisStart + 120, Math.ceil(Math.max(...endMinsList) / 30) * 30);
  const axisSpan = axisEnd - axisStart; // minutes
  const ticks: number[] = [];
  for (let m = axisStart; m <= axisEnd; m += 30) ticks.push(m);

  // Fixed pixel width per 30-min slot. Scales modestly with viewport so
  // we don't crush cards on tiny zones.
  const slotWidth = scaled(130, viewport, 72);
  const pxPerMinute = slotWidth / 30;
  const tracksWidth = (axisSpan / 30) * slotWidth;

  // Now-line: prefer the midpoint of a live entry, fall back to the
  // schedule's `generatedAt` timestamp (deterministic for snapshot
  // tests), and finally `new Date()` as a last resort. That way the
  // banner stays anchored to "something happening now" when an
  // aufguss is running, and otherwise tracks the schedule clock.
  const live = entries.find((e) => e.cell.isLive);
  const generatedDate = data.generatedAt ? new Date(data.generatedAt) : null;
  const clockDate =
    generatedDate && Number.isFinite(generatedDate.getTime())
      ? generatedDate
      : new Date();
  const nowMinutesFromClock = clockDate.getHours() * 60 + clockDate.getMinutes();
  const nowMinutes = live
    ? live.minutes + Math.max(0, (live.cell.durationMin ?? 15) / 2)
    : nowMinutesFromClock;
  const nowPx = (nowMinutes - axisStart) * pxPerMinute;
  const nowVisible = nowPx >= 0 && nowPx <= tracksWidth;
  const nowClockLabel = formatTime(nowMinutesFromClock);

  const pad = scaled(spacingTokens.lg, viewport, 12);
  const labelColWidth = scaled(190, viewport, 110);
  const rowHeight = scaled(88, viewport, 52);
  const axisLabelHeight = scaled(40, viewport, 24);
  const nowBannerHeight = scaled(30, viewport, 22);

  // Group flat entries by sauna index for track rendering.
  const bySauna = new Map<number, FlatEntry[]>();
  for (const e of entries) {
    const list = bySauna.get(e.saunaIndex) ?? [];
    list.push(e);
    bySauna.set(e.saunaIndex, list);
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacingTokens.md, viewport, 8),
      }}
    >
      <Masthead count={entries.length} tokens={tokens} viewport={viewport} />
      <div style={brassHairline(colors, 1)} />

      {/* Two-column layout: sauna labels on the left (fixed), horizontally
          auto-scrolling tracks on the right. Row heights in both columns
          match pixel-for-pixel so the labels line up with their tracks. */}
      <div
        className="grid flex-1 min-h-0"
        style={{
          gridTemplateColumns: `${labelColWidth}px 1fr`,
          columnGap: scaled(spacingTokens.md, viewport, 8),
          alignItems: 'start',
        }}
      >
        {/* Left column: sticky sauna labels */}
        <div className="flex flex-col" style={{ gap: scaled(spacingTokens.sm, viewport, 4) }}>
          {/* Spacer matches axis + now-banner height so label rows align */}
          <div
            aria-hidden
            style={{
              height: axisLabelHeight + nowBannerHeight + scaled(10, viewport, 4),
            }}
          />
          {data.saunas.map((sauna) => {
            const accent = sauna.color || colors.accentPrimary;
            return (
              <div
                key={sauna.id}
                className="flex items-center"
                style={{
                  gap: scaled(12, viewport, 4),
                  minHeight: rowHeight,
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: scaled(40, viewport, 20),
                    backgroundColor: withAlpha(accent, 0.9),
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span
                    className="truncate"
                    style={{
                      color: colors.textPrimary,
                      fontFamily: typography.fontHeading,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
                      fontWeight: 500,
                      letterSpacing: '-0.005em',
                      lineHeight: 1.15,
                    }}
                    title={sauna.name}
                  >
                    {sauna.name}
                  </span>
                  {sauna.temperatureC != null ? (
                    <span
                      className="tabular-nums"
                      style={{
                        color: withAlpha(colors.textSecondary, 0.85),
                        fontFamily: typography.fontMono,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 8)}px`,
                        letterSpacing: '0.03em',
                        marginTop: 2,
                      }}
                    >
                      {Math.round(sauna.temperatureC)} °C
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column: horizontally auto-scrolling tracks */}
        <AutoScroll axis="x" className="h-full" speedPxPerSec={14} startDelayMs={5000}>
          <div
            className="flex flex-col"
            style={{
              width: tracksWidth,
              gap: scaled(spacingTokens.sm, viewport, 4),
            }}
          >
            {/* Axis labels row */}
            <div className="relative" style={{ height: axisLabelHeight, width: tracksWidth }}>
              {ticks.map((m, idx) => {
                const left = idx * slotWidth;
                const isMajor = m % 60 === 0;
                return (
                  <div
                    key={m}
                    className="absolute tabular-nums"
                    style={{
                      left,
                      bottom: 0,
                      transform: 'translateX(-50%)',
                      color: withAlpha(
                        colors.textSecondary,
                        isMajor ? 0.95 : 0.7,
                      ),
                      fontFamily: typography.fontMono,
                      fontSize: `${scaledFont(
                        typography.baseSizePx * (isMajor ? typography.scaleBase : typography.scaleSm),
                        viewport,
                        isMajor ? 10 : 9,
                      )}px`,
                      letterSpacing: '0.04em',
                      fontWeight: isMajor ? 600 : 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatTime(m)}
                  </div>
                );
              })}
            </div>

            {/* "JETZT" banner + now-line — rendered once, spans all rows */}
            <div
              className="relative"
              style={{ height: nowBannerHeight, width: tracksWidth }}
            >
              {nowVisible ? (
                <div
                  className="absolute flex items-center tabular-nums"
                  style={{
                    left: nowPx,
                    top: 0,
                    transform: 'translateX(-50%)',
                    gap: scaled(6, viewport, 2),
                    padding: `${scaled(4, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
                    borderRadius: 9999,
                    backgroundColor: withAlpha(colors.statusLive, 0.22),
                    border: `1px solid ${withAlpha(colors.statusLive, 0.75)}`,
                    boxShadow: `0 0 18px ${withAlpha(colors.statusLive, 0.5)}`,
                    color: colors.statusLive,
                    fontFamily: typography.fontBody,
                    fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9)}px`,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    zIndex: 3,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: colors.statusLive,
                      boxShadow: `0 0 10px ${withAlpha(colors.statusLive, 0.95)}`,
                    }}
                  />
                  Jetzt · {nowClockLabel}
                </div>
              ) : null}
            </div>

            {/* One track per sauna */}
            {data.saunas.map((sauna, saunaIdx) => {
              const rowEntries = bySauna.get(saunaIdx) ?? [];
              const accent = sauna.color || colors.accentPrimary;
              return (
                <div
                  key={sauna.id}
                  className="relative"
                  style={{
                    height: rowHeight,
                    width: tracksWidth,
                  }}
                >
                  {/* Track backdrop */}
                  <div
                    className="absolute inset-0"
                    style={{
                      borderRadius: radius.md,
                      backgroundColor: withAlpha(colors.surfaceElevated, 0.55),
                      border: `1px solid ${withAlpha(colors.border, 0.6)}`,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Tick lines */}
                    {ticks.slice(1, -1).map((m, idx) => {
                      const left = (idx + 1) * slotWidth;
                      const isMajor = m % 60 === 0;
                      return (
                        <div
                          key={m}
                          aria-hidden
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left,
                            width: 1,
                            backgroundColor: withAlpha(
                              colors.border,
                              isMajor ? 0.65 : 0.4,
                            ),
                            pointerEvents: 'none',
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Now-line glows through every track */}
                  {nowVisible ? (
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: nowPx,
                        width: 2,
                        backgroundColor: colors.statusLive,
                        boxShadow: `0 0 14px ${withAlpha(colors.statusLive, 0.9)}, 0 0 32px ${withAlpha(colors.statusLive, 0.45)}`,
                        zIndex: 1,
                      }}
                    />
                  ) : null}

                  {/* Entries */}
                  {rowEntries.map((entry) => {
                    const startPx = Math.max(0, (entry.minutes - axisStart) * pxPerMinute);
                    const dur = entry.cell.durationMin ?? 15;
                    const widthPx = Math.max(scaled(70, viewport, 40), dur * pxPerMinute);
                    const isFinished = !!entry.cell.isFinished;
                    const fill = entry.cell.isLive
                      ? colors.statusLive
                      : entry.cell.isPrestart
                        ? colors.statusWarning
                        : entry.cell.isNext
                          ? colors.statusNext
                          : accent;

                    const timeColor = entry.cell.isLive
                      ? colors.statusLive
                      : isFinished
                        ? withAlpha(colors.textPrimary, 0.6)
                        : withAlpha(fill, 0.95);
                    const titleColor = isFinished
                      ? withAlpha(colors.textPrimary, 0.55)
                      : colors.textPrimary;

                    return (
                      <div
                        key={entry.key}
                        title={entry.cell.title}
                        style={{
                          position: 'absolute',
                          top: scaled(6, viewport, 2),
                          bottom: scaled(6, viewport, 2),
                          left: startPx,
                          width: widthPx,
                          padding: `${scaled(8, viewport, 3)}px ${scaled(12, viewport, 4)}px`,
                          borderRadius: radius.md,
                          backgroundColor: withAlpha(
                            fill,
                            isFinished ? 0.14 : entry.cell.isLive ? 0.32 : 0.22,
                          ),
                          border: `1px solid ${withAlpha(
                            fill,
                            isFinished ? 0.4 : 0.9,
                          )}`,
                          boxShadow: entry.cell.isLive
                            ? `0 0 18px ${withAlpha(colors.statusLive, 0.35)}`
                            : `0 1px 0 ${withAlpha(fill, 0.08)}`,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: scaled(3, viewport, 1),
                          opacity: isFinished ? 0.75 : 1,
                          zIndex: 2,
                        }}
                      >
                        <div
                          className="flex items-center tabular-nums"
                          style={{ gap: scaled(6, viewport, 2) }}
                        >
                          {entry.cell.isLive ? (
                            <span
                              aria-hidden
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: colors.statusLive,
                                boxShadow: `0 0 10px ${withAlpha(colors.statusLive, 0.95)}`,
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                          <span
                            style={{
                              color: timeColor,
                              fontFamily: typography.fontMono,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              lineHeight: 1,
                            }}
                          >
                            {entry.time}
                          </span>
                          {entry.cell.intensity != null && entry.cell.intensity > 0 ? (
                            <span
                              className="tabular-nums"
                              style={{
                                color: timeColor,
                                fontFamily: typography.fontMono,
                                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8)}px`,
                                fontWeight: 500,
                                letterSpacing: '0.06em',
                                opacity: 0.85,
                              }}
                            >
                              · {romanNumeral(entry.cell.intensity)}
                            </span>
                          ) : null}
                        </div>
                        <span
                          style={{
                            color: titleColor,
                            fontFamily: typography.fontHeading,
                            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase * 1.05, viewport, 10)}px`,
                            fontWeight: 500,
                            lineHeight: 1.15,
                            letterSpacing: '-0.005em',
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitBoxOrient: 'vertical',
                            WebkitLineClamp: 2,
                          }}
                        >
                          {entry.cell.title}
                        </span>
                      </div>
                    );
                  })}

                  {sauna.outOfOrder ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: radius.md,
                        backgroundColor: withAlpha(colors.statusWarning, 0.08),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: withAlpha(colors.statusWarning, 0.95),
                        fontFamily: typography.fontBody,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        zIndex: 2,
                      }}
                    >
                      Außer Betrieb
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </AutoScroll>
      </div>
    </div>
  );
}
