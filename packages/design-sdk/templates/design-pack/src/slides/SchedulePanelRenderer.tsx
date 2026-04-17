import type {
  SchedulePanelCell,
  SchedulePanelData,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { scaled, scaledFont } from './responsive';

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
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}

function Cell({ cell, tokens, viewport }: CellProps) {
  const { colors, typography, radius } = tokens;
  if (!cell) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          minHeight: `${scaled(32, viewport, 12)}px`,
          color: withAlpha(colors.textSecondary, 0.45),
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
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
        borderRadius: `${scaled(12, viewport, 4)}px`,
        border: `1px solid ${statusBorder}`,
        padding: `${scaled(8, viewport, 3)}px`,
        gap: 2,
      }}
    >
      <span
        className="font-bold"
        style={{
          color: colors.textPrimary,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
            color: colors.textSecondary,
          }}
        >
          {cell.aromas!.slice(0, 2).map((aroma) => (
            <span key={aroma.id} className="inline-flex items-center" style={{ gap: 2 }}>
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
            padding: '2px 6px',
            borderRadius: `${radius.pill}px`,
            letterSpacing: '0.12em',
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
            padding: '2px 6px',
            borderRadius: `${radius.pill}px`,
            letterSpacing: '0.12em',
          }}
        >
          Gleich
        </span>
      ) : null}
    </div>
  );
}

/**
 * {{designName}} — content-panel (schedule grid) slide renderer.
 *
 * Structure is constant regardless of container size: time-slot rows x
 * sauna columns. Only padding, font sizes and gaps scale with the
 * viewport. When rows exceed the available height, the body auto-
 * scrolls instead of showing a scrollbar.
 */
export function SchedulePanelRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;

  if (data.saunas.length === 0 || data.timeSlots.length === 0) {
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

  const columns = `auto repeat(${data.saunas.length}, minmax(0, 1fr))`;
  const pad = scaled(24, viewport, 8);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
        gap: `${scaled(spacing.md, viewport, 4)}px`,
      }}
    >
      <div className="flex items-baseline justify-between shrink-0">
        <span
          className="font-black uppercase"
          style={{
            color: colors.accentPrimary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
            letterSpacing: '0.3em',
          }}
        >
          Aufgussplan
        </span>
        <span
          className="font-semibold"
          style={{
            color: colors.textSecondary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
          }}
        >
          {data.timeSlots.length} Slots · {data.saunas.length} Saunen
        </span>
      </div>

      <div
        className="grid shrink-0"
        style={{
          gridTemplateColumns: columns,
          gap: `${scaled(spacing.xs, viewport, 2)}px`,
        }}
      >
        <div />
        {data.saunas.map((sauna) => (
          <div
            key={sauna.id}
            className="font-black uppercase"
            style={{
              color: colors.textPrimary,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
              letterSpacing: '0.1em',
              padding: `${scaled(4, viewport, 2)}px ${scaled(8, viewport, 3)}px`,
              backgroundColor: withAlpha(colors.accentSecondary, 0.15),
              borderRadius: `${scaled(12, viewport, 4)}px`,
              textAlign: 'center',
            }}
          >
            {sauna.name}
          </div>
        ))}
      </div>

      <AutoScroll className="flex-1 min-h-0">
        <div
          className="grid"
          style={{
            gridTemplateColumns: columns,
            gap: `${scaled(spacing.xs, viewport, 2)}px`,
            alignContent: 'start',
          }}
        >
          {data.timeSlots.map((time, slotIdx) => (
            <TimeRow
              key={time}
              time={time}
              saunas={data.saunas}
              cells={data.saunas.map(
                (_, saunaIdx) => data.cells[saunaIdx]?.[slotIdx] ?? null,
              )}
              tokens={tokens}
              viewport={viewport}
            />
          ))}
        </div>
      </AutoScroll>
    </div>
  );
}

function TimeRow({
  time,
  saunas,
  cells,
  tokens,
  viewport,
}: {
  time: string;
  saunas: SchedulePanelData['saunas'];
  cells: Array<SchedulePanelCell | null>;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  return (
    <>
      <div
        className="font-mono font-black"
        style={{
          color: colors.accentPrimary,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
          padding: `${scaled(4, viewport, 2)}px ${scaled(8, viewport, 3)}px`,
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
          viewport={viewport}
        />
      ))}
    </>
  );
}
