import type {
  IntensityDisplay,
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelStyle,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { SchedulePanelGrid } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  IntensityMark as SharedIntensityMark,
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
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
 *   - list     — chronological "playbill for the evening" (compact-tiles)
 *   - matrix   — Wellness-Classic Saunakacheln grid (modern-wellness),
 *                rendered with Aurora's brass palette. Shared via SDK
 *                so all packs that opt in stay in lock-step.
 *   - timeline — Aurora's saunas-as-columns brass grid (formerly the
 *                "matrix" slot), now offered under the modern-timeline
 *                designStyle. The previous timeline variant was retired
 *                in favour of giving operators the brass grid + grid
 *                pair as the two flavours.
 */
export function SchedulePanelRenderer(props: SlideRendererProps<'content-panel'>) {
  const hint: SchedulePanelStyle = props.data.styleHint ?? 'list';
  switch (hint) {
    case 'matrix':
      return <SchedulePanelGrid {...props} voice="editorial" />;
    case 'timeline':
      return <MatrixVariant {...props} />;
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
 * Intensity mark — flames by default, Roman numerals when the host's
 * `intensityDisplay` context prefers them. Thin wrapper over the
 * shared utility so each pack can pick a size / idle colour that
 * matches its surface.
 */
function IntensityMark({
  level,
  color,
  idleColor,
  viewport,
  tokens,
  display,
  sizePx,
}: {
  level: number;
  color: string;
  idleColor?: string;
  viewport: Viewport;
  tokens: Tokens;
  display: IntensityDisplay;
  /** Override the default 18px footprint (e.g. 13px for the dense matrix grid). */
  sizePx?: number;
}) {
  const { typography, colors } = tokens;
  // Default 18px sits comfortably alongside list-row times. Cells in
  // the dense matrix override down to ~13px so the mark doesn't
  // dominate a small card.
  const size = sizePx ?? scaled(18, viewport, 12);
  return (
    <SharedIntensityMark
      level={level}
      color={color}
      idleColor={idleColor ?? withAlpha(colors.accentPrimary, 0.2)}
      size={size}
      display={display}
      fontFamily={typography.fontMono}
    />
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
  const intensityDisplay = context.intensityDisplay ?? 'flames';

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
  tokens,
  viewport,
  intensityDisplay,
}: {
  entry: FlatEntry;
  tokens: Tokens;
  viewport: Viewport;
  intensityDisplay: IntensityDisplay;
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

      {/* Intensity column — fixed width, centered. Renders a blank
          slot (not null) when the entry has no intensity so rows
          without intensity keep the flames' column empty rather than
          collapsing and dragging the status chip left. Same idea
          wellness-classic uses. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: scaled(110, viewport, 68),
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
            display={intensityDisplay}
          />
        ) : null}
      </div>

      {/* Status column — fixed width, centered. Empty when no status,
          but still holds its width so the neighbouring intensity
          column never drifts into its spot. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: scaled(112, viewport, 66),
        }}
      >
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
  const intensityDisplay = context.intensityDisplay ?? 'flames';

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

  // Time axis in 30-minute buckets.
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

  // Per-bucket flag: any sauna has an entry here? Drives the row-height
  // compression — empty buckets shrink to a hairline so the visible
  // time-window roughly doubles without the layout fragmenting.
  const bucketHasItems = new Map<number, boolean>();
  for (const bucket of buckets) {
    let any = false;
    for (let s = 0; s < data.saunas.length; s++) {
      if ((entryAt.get(`${s}:${bucket}`)?.length ?? 0) > 0) {
        any = true;
        break;
      }
    }
    bucketHasItems.set(bucket, any);
  }

  const pad = scaled(spacingTokens.lg, viewport, 12);
  const timeColWidth = scaled(82, viewport, 48);
  const gridTemplateColumns = `${timeColWidth}px repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: scaled(spacingTokens.md, viewport, 8),
      }}
    >
      {/* Brass corner glow — gives the panel material weight. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 0% 0%, ${withAlpha(colors.accentPrimary, 0.08)} 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-10 flex flex-col" style={{ gap: scaled(spacingTokens.md, viewport, 8) }}>
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
      </div>

      <AutoScroll className="relative z-10 flex-1 min-h-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns,
            columnGap: scaled(spacingTokens.sm, viewport, 4),
            rowGap: scaled(3, viewport, 1),
          }}
        >
          {buckets.map((bucket) => {
            const timeLabel = formatTime(bucket);
            const isMajorHour = bucket % 60 === 0;
            const isEmpty = !bucketHasItems.get(bucket);
            return (
              <MatrixBucketRow
                key={bucket}
                timeLabel={timeLabel}
                bucket={bucket}
                entryAt={entryAt}
                saunaCount={data.saunas.length}
                tokens={tokens}
                viewport={viewport}
                intensityDisplay={intensityDisplay}
                isMajorHour={isMajorHour}
                isEmpty={isEmpty}
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
  intensityDisplay,
  isMajorHour,
  isEmpty,
}: {
  timeLabel: string;
  bucket: number;
  entryAt: Map<string, FlatEntry[]>;
  saunaCount: number;
  tokens: Tokens;
  viewport: Viewport;
  intensityDisplay: IntensityDisplay;
  isMajorHour: boolean;
  isEmpty: boolean;
}) {
  const { colors, typography } = tokens;

  // Time-label styling. Major hour (XX:00) reads as the primary axis tick;
  // half-hour (XX:30) is dimmed and a notch smaller so the eye can scan
  // hours at a glance without being distracted.
  const labelOpacity = isMajorHour ? (isEmpty ? 0.55 : 0.95) : isEmpty ? 0.28 : 0.55;
  const labelWeight = isMajorHour ? 600 : 400;
  const labelSize = isMajorHour
    ? scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)
    : scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9);

  // Empty buckets collapse to a thin spacer so the visible time-window
  // fits roughly twice as many hours. Major hours stay a touch taller
  // than half-hour spacers so the rhythm is still legible.
  const emptyMin = isMajorHour
    ? scaled(20, viewport, 8)
    : scaled(12, viewport, 5);

  // Subtle brass hairline above each major hour — gives the eye a
  // horizontal anchor point every 60 minutes without painting a heavy
  // grid. Renders as `box-shadow` on the time-label cell so it spans
  // the whole row visually without extra grid items.
  const majorTickShadow = isMajorHour
    ? `inset 0 1px 0 0 ${withAlpha(colors.accentPrimary, 0.25)}`
    : undefined;

  return (
    <>
      <div
        className="flex items-start tabular-nums"
        style={{
          paddingTop: isEmpty ? scaled(2, viewport, 1) : scaled(6, viewport, 2),
          boxShadow: majorTickShadow,
        }}
      >
        <span
          style={{
            color: colors.textSecondary,
            fontFamily: typography.fontMono,
            fontSize: `${labelSize}px`,
            letterSpacing: '0.04em',
            fontWeight: labelWeight,
            opacity: labelOpacity,
            lineHeight: 1,
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
            style={{
              gap: scaled(4, viewport, 1),
              minHeight: items.length > 0 ? 0 : emptyMin,
              boxShadow: majorTickShadow,
            }}
          >
            {items.map((entry) => (
              <MatrixCell
                key={entry.key}
                entry={entry}
                tokens={tokens}
                viewport={viewport}
                intensityDisplay={intensityDisplay}
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
  intensityDisplay,
}: {
  entry: FlatEntry;
  tokens: Tokens;
  viewport: Viewport;
  intensityDisplay: IntensityDisplay;
}) {
  const { colors, typography, radius } = tokens;
  const { cell } = entry;
  const isFinished = !!cell.isFinished;
  const accent = entry.saunaColor || colors.accentPrimary;

  const borderColor = cell.isLive
    ? withAlpha(colors.statusLive, 0.55)
    : cell.isPrestart
      ? withAlpha(colors.statusWarning, 0.45)
      : cell.isNext
        ? withAlpha(colors.statusNext, 0.4)
        : isFinished
          ? withAlpha(colors.border, 0.45)
          : withAlpha(colors.accentPrimary, 0.22);

  // Frosted-brass material: warm surface with a hint of brass on the
  // left edge so the eye reads "sauna lane" without a heavy column rule.
  const leftAccent = cell.isLive
    ? colors.statusLive
    : cell.isPrestart
      ? colors.statusWarning
      : cell.isNext
        ? colors.statusNext
        : accent;

  return (
    <div
      style={{
        padding: `${scaled(7, viewport, 3)}px ${scaled(11, viewport, 4)}px`,
        borderRadius: radius.md,
        border: `1px solid ${borderColor}`,
        borderLeft: `2px solid ${withAlpha(leftAccent, isFinished ? 0.45 : 0.85)}`,
        backgroundColor: cell.isLive
          ? withAlpha(colors.statusLive, 0.08)
          : withAlpha(colors.surfaceElevated, 0.7),
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: cell.isLive
          ? `0 4px 18px ${withAlpha(colors.statusLive, 0.22)}, inset 0 0 0 1px ${withAlpha(colors.statusLive, 0.18)}`
          : `0 1px 0 ${withAlpha(colors.accentPrimary, 0.06)}`,
        opacity: isFinished ? 0.72 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: scaled(3, viewport, 1),
      }}
    >
      <div className="flex items-center justify-between" style={{ gap: scaled(6, viewport, 2) }}>
        <span
          className="tabular-nums"
          style={{
            color: cell.isLive
              ? colors.statusLive
              : isFinished
                ? withAlpha(colors.textSecondary, 0.7)
                : accent,
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
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
            sizePx={scaled(13, viewport, 9)}
            display={intensityDisplay}
          />
        ) : null}
      </div>
      <span
        className="line-clamp-2"
        style={{
          color: isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
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
            color: withAlpha(colors.textSecondary, 0.85),
            fontFamily: typography.fontBody,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
            fontWeight: 500,
            letterSpacing: '0.02em',
            fontStyle: 'italic',
          }}
        >
          {cell.aromas.map((a) => (a.emoji ? `${a.emoji} ${a.name}` : a.name)).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}


