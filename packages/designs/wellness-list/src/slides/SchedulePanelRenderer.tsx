import type {
  SchedulePanelData,
  SchedulePanelCell,
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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((part) => parseInt(part, 10));
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : Number.POSITIVE_INFINITY;
}

interface MergedRow {
  id: string;
  time: string;
  saunaId: string;
  saunaName: string;
  cell: SchedulePanelCell;
}

function flattenChronologically(data: SchedulePanelData): MergedRow[] {
  const merged: MergedRow[] = [];
  data.saunas.forEach((sauna, saunaIdx) => {
    const row = data.cells[saunaIdx] ?? [];
    row.forEach((cell, slotIdx) => {
      if (!cell) return;
      const time = data.timeSlots[slotIdx] ?? '';
      merged.push({
        id: `${sauna.id}-${slotIdx}-${cell.title}`,
        time,
        saunaId: sauna.id,
        saunaName: sauna.name,
        cell,
      });
    });
  });
  return merged.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

/**
 * Wellness List — content-panel renderer.
 *
 * Flattens the saunas × time-slot matrix into a single chronological
 * list. Replaces the column grid of wellness-classic with a scannable
 * feed-style layout — useful for compact zones or signage that prefers
 * a "what's next, in order" reading flow.
 */
export function SchedulePanelRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;

  if (data.saunas.length === 0) {
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
        Keine Saunen geplant.
      </div>
    );
  }

  const rows = flattenChronologically(data);
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
          Aufgussplan · Chronologisch
        </span>
        <span
          className="font-semibold"
          style={{
            color: colors.textSecondary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
          }}
        >
          {rows.length} Einträge · {data.saunas.length} Saunen
        </span>
      </div>

      <div
        className="flex flex-wrap shrink-0"
        style={{ gap: `${scaled(8, viewport, 3)}px` }}
      >
        {data.saunas.map((sauna) => (
          <span
            key={sauna.id}
            className="font-bold uppercase"
            style={{
              color: colors.textSecondary,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
              letterSpacing: '0.12em',
              padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
              backgroundColor: withAlpha(colors.accentSecondary, 0.12),
              borderRadius: `${radius.pill}px`,
            }}
          >
            {sauna.name}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center"
          style={{ color: colors.textSecondary }}
        >
          Keine Aufgüsse heute geplant.
        </div>
      ) : (
        <AutoScroll className="flex-1 min-h-0">
          <ul className="flex flex-col" style={{ gap: `${scaled(6, viewport, 2)}px` }}>
            {rows.map((row) => {
              const cell = row.cell;
              const tint = cell.isLive
                ? withAlpha(colors.statusLive, 0.12)
                : cell.isNext
                  ? withAlpha(colors.statusNext, 0.12)
                  : withAlpha(colors.surfaceElevated, 0.85);
              const accent = cell.isLive
                ? colors.statusLive
                : cell.isNext
                  ? colors.statusNext
                  : colors.accentPrimary;
              return (
                <li
                  key={row.id}
                  className="flex items-center"
                  style={{
                    backgroundColor: tint,
                    border: `1px solid ${withAlpha(accent, 0.25)}`,
                    borderLeft: `4px solid ${accent}`,
                    borderRadius: `${scaled(radius.md, viewport, 4)}px`,
                    padding: `${scaled(8, viewport, 3)}px ${scaled(14, viewport, 5)}px`,
                    gap: `${scaled(16, viewport, 5)}px`,
                  }}
                >
                  <span
                    className="font-mono font-black shrink-0"
                    style={{
                      color: accent,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
                      lineHeight: 1,
                      minWidth: scaled(56, viewport, 36),
                    }}
                  >
                    {row.time}
                  </span>
                  <span
                    className="font-semibold uppercase shrink-0"
                    style={{
                      color: colors.textSecondary,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                      letterSpacing: '0.1em',
                      minWidth: scaled(120, viewport, 80),
                    }}
                  >
                    {row.saunaName}
                  </span>
                  <span
                    className="font-black uppercase min-w-0 flex-1 truncate"
                    style={{
                      color: colors.textPrimary,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {cell.title}
                  </span>
                  {(cell.aromas?.length ?? 0) > 0 ? (
                    <span
                      className="shrink-0"
                      style={{
                        color: colors.textSecondary,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                      }}
                    >
                      {cell.aromas![0].emoji ? `${cell.aromas![0].emoji} ` : ''}
                      {cell.aromas![0].name}
                    </span>
                  ) : null}
                  {cell.isLive ? (
                    <span
                      className="font-black uppercase shrink-0"
                      style={{
                        color: colors.textInverse,
                        backgroundColor: colors.statusLive,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
                        padding: `${scaled(3, viewport, 2)}px ${scaled(10, viewport, 4)}px`,
                        borderRadius: `${radius.pill}px`,
                        letterSpacing: '0.18em',
                      }}
                    >
                      LÄUFT
                    </span>
                  ) : cell.isNext ? (
                    <span
                      className="font-black uppercase shrink-0"
                      style={{
                        color: colors.textInverse,
                        backgroundColor: colors.statusNext,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
                        padding: `${scaled(3, viewport, 2)}px ${scaled(10, viewport, 4)}px`,
                        borderRadius: `${radius.pill}px`,
                        letterSpacing: '0.18em',
                      }}
                    >
                      GLEICH
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </AutoScroll>
      )}
    </div>
  );
}
