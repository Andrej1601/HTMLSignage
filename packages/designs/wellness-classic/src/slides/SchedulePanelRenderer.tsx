import type {
  SchedulePanelCell,
  SchedulePanelData,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';

function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  const clamped = Math.max(0, Math.min(1, alpha));
  if (c.startsWith('#')) {
    const raw = c.slice(1);
    const hex = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
    if (hex.length !== 6) return c;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clamped})`;
  }
  return c;
}

interface CellProps {
  cell: SchedulePanelCell | null;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  saunaName: string;
}

function Cell({ cell, tokens }: CellProps) {
  const { colors, typography, spacing, radius } = tokens;
  if (!cell) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          minHeight: `${spacing.lg * 2}px`,
          color: withAlpha(colors.textSecondary, 0.45),
          fontFamily: typography.fontMono,
          fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
        }}
      >
        —
      </div>
    );
  }

  const statusBg = cell.isLive
    ? withAlpha(colors.statusLive, 0.15)
    : cell.isNext
      ? withAlpha(colors.statusNext, 0.15)
      : withAlpha(colors.surfaceElevated, 0.8);

  const statusBorder = cell.isLive
    ? withAlpha(colors.statusLive, 0.4)
    : cell.isNext
      ? withAlpha(colors.statusNext, 0.4)
      : colors.border;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: statusBg,
        borderRadius: `${radius.md}px`,
        border: `1px solid ${statusBorder}`,
        padding: `${spacing.sm}px`,
        gap: 2,
      }}
    >
      <span
        className="font-bold"
        style={{
          color: colors.textPrimary,
          fontSize: `${typography.baseSizePx * typography.scaleBase}px`,
          lineHeight: 1.15,
        }}
      >
        {cell.title}
      </span>
      {(cell.aromas?.length ?? 0) > 0 ? (
        <div
          className="flex flex-wrap"
          style={{
            gap: 4,
            fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
            color: colors.textSecondary,
          }}
        >
          {cell.aromas!.slice(0, 2).map((aroma) => (
            <span
              key={aroma.id}
              className="inline-flex items-center"
              style={{ gap: 2 }}
            >
              {aroma.emoji ? <span>{aroma.emoji}</span> : null}
              <span>{aroma.name}</span>
            </span>
          ))}
          {(cell.aromas?.length ?? 0) > 2 ? (
            <span>+{cell.aromas!.length - 2}</span>
          ) : null}
        </div>
      ) : null}
      {cell.isLive ? (
        <span
          className="self-start font-black uppercase"
          style={{
            color: colors.textInverse,
            backgroundColor: colors.statusLive,
            fontSize: `${typography.baseSizePx * typography.scaleSm * 0.85}px`,
            padding: '2px 6px',
            borderRadius: `${radius.pill}px`,
            letterSpacing: '0.15em',
          }}
        >
          LÄUFT
        </span>
      ) : cell.isNext ? (
        <span
          className="self-start font-black uppercase"
          style={{
            color: colors.textInverse,
            backgroundColor: colors.statusNext,
            fontSize: `${typography.baseSizePx * typography.scaleSm * 0.85}px`,
            padding: '2px 6px',
            borderRadius: `${radius.pill}px`,
            letterSpacing: '0.15em',
          }}
        >
          Als Nächstes
        </span>
      ) : null}
    </div>
  );
}

/**
 * Wellness Classic — content-panel (schedule grid) slide renderer.
 *
 * Time slots as rows, saunas as columns. Live / next flags (derived
 * once per data tick in the hook) drive a soft highlight. Missing
 * entries show an em-dash.
 */
export function SchedulePanelRenderer({
  data,
  tokens,
}: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing, radius } = tokens;

  if (data.saunas.length === 0 || data.timeSlots.length === 0) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: colors.textSecondary,
          fontFamily: typography.fontBody,
          fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
        }}
      >
        Heute keine Einträge geplant.
      </div>
    );
  }

  const columns = `auto repeat(${data.saunas.length}, minmax(0, 1fr))`;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${spacing.lg}px`,
        gap: `${spacing.md}px`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-black uppercase"
          style={{
            color: colors.accentPrimary,
            fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
            letterSpacing: '0.3em',
          }}
        >
          Aufgussplan
        </span>
        <span
          className="font-semibold"
          style={{
            color: colors.textSecondary,
            fontSize: `${typography.baseSizePx * typography.scaleSm}px`,
          }}
        >
          {data.timeSlots.length} Zeitslots · {data.saunas.length} Saunen
        </span>
      </div>

      <div
        className="grid flex-1 overflow-auto"
        style={{
          gridTemplateColumns: columns,
          gap: `${spacing.xs}px`,
          alignContent: 'start',
        }}
      >
        {/* Header row: empty + sauna names */}
        <div />
        {data.saunas.map((sauna) => (
          <div
            key={sauna.id}
            className="font-black uppercase"
            style={{
              color: colors.textPrimary,
              fontSize: `${typography.baseSizePx * typography.scaleBase}px`,
              letterSpacing: '0.1em',
              padding: `${spacing.xs}px ${spacing.sm}px`,
              backgroundColor: withAlpha(colors.accentSecondary, 0.15),
              borderRadius: `${radius.md}px`,
              textAlign: 'center',
            }}
          >
            {sauna.name}
          </div>
        ))}

        {/* Body rows */}
        {data.timeSlots.map((time, slotIdx) => (
          <TimeRow
            key={time}
            time={time}
            saunas={data.saunas}
            cells={data.saunas.map((_, saunaIdx) => data.cells[saunaIdx]?.[slotIdx] ?? null)}
            tokens={tokens}
          />
        ))}
      </div>
    </div>
  );
}

function TimeRow({
  time,
  saunas,
  cells,
  tokens,
}: {
  time: string;
  saunas: SchedulePanelData['saunas'];
  cells: Array<SchedulePanelCell | null>;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
}) {
  const { colors, typography, spacing, radius } = tokens;
  return (
    <>
      <div
        className="font-mono font-black"
        style={{
          color: colors.accentPrimary,
          fontSize: `${typography.baseSizePx * typography.scaleLg}px`,
          padding: `${spacing.xs}px ${spacing.sm}px`,
          backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
          borderRadius: `${radius.sm}px`,
          alignSelf: 'stretch',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {time}
      </div>
      {cells.map((cell, idx) => (
        <Cell
          key={`${time}-${saunas[idx].id}`}
          cell={cell}
          tokens={tokens}
          saunaName={saunas[idx].name}
        />
      ))}
    </>
  );
}
