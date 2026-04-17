import type {
  SchedulePanelCell,
  SchedulePanelData,
  SchedulePanelSauna,
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

const ACCENT_FALLBACKS = ['#F59E0B', '#10B981', '#c5a059', '#8B6F47'];

function saunaAccentFor(
  sauna: SchedulePanelSauna,
  index: number,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
): string {
  if (sauna.accentColor) return sauna.accentColor;
  const palette = [tokens.colors.accentPrimary, tokens.colors.accentSecondary, ...ACCENT_FALLBACKS];
  return palette[index % palette.length];
}

function FlameIcon({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

interface MergedRow {
  id: string;
  saunaName: string;
  saunaAccent: string;
  cell: SchedulePanelCell;
}

function flattenChronologically(
  data: SchedulePanelData,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
): MergedRow[] {
  const merged: MergedRow[] = [];
  data.saunas.forEach((sauna, saunaIdx) => {
    if (sauna.isOutOfOrder) return;
    const accent = saunaAccentFor(sauna, saunaIdx, tokens);
    const row = data.cells[saunaIdx] ?? [];
    row.forEach((cell, slotIdx) => {
      if (!cell) return;
      merged.push({
        id: `${sauna.id}-${slotIdx}-${cell.title}`,
        saunaName: sauna.name,
        saunaAccent: accent,
        cell,
      });
    });
  });
  return merged.sort((a, b) => timeToMinutes(a.cell.time) - timeToMinutes(b.cell.time));
}

/**
 * Wellness List — content-panel renderer (legacy `compact-tiles`).
 *
 * One horizontal row per infusion, sorted chronologically across all
 * saunas. Each row shows: time · sauna dot + name · title · intensity
 * flames · duration · live/next badge. Auto-scrolls when overflowing.
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

  const rows = flattenChronologically(data, tokens);
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
          {rows.length} Einträge
        </span>
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
            {rows.map((row, index) => {
              const cell = row.cell;
              const isOngoing = cell.isLive;
              const isPrestart = cell.isPrestart === true;
              const isFinished = cell.isFinished === true;
              const isNext = cell.isNext;
              const isEven = index % 2 === 0;

              const rowBg = isOngoing
                ? withAlpha(colors.statusLive, 0.12)
                : isPrestart
                  ? withAlpha(colors.statusWarning, 0.12)
                  : isNext
                    ? withAlpha(colors.statusNext, 0.12)
                    : isFinished
                      ? withAlpha(colors.surfaceElevated, 0.4)
                      : withAlpha(colors.surfaceElevated, isEven ? 0.7 : 0.4);
              const leftBar = isOngoing
                ? colors.statusLive
                : isPrestart
                  ? colors.statusWarning
                  : isNext
                    ? colors.statusNext
                    : row.saunaAccent;
              const timeColor = isOngoing
                ? colors.statusLive
                : isPrestart
                  ? colors.statusWarning
                  : isFinished
                    ? withAlpha(colors.textPrimary, 0.4)
                    : colors.textPrimary;
              const titleColor = isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary;

              return (
                <li
                  key={row.id}
                  className="flex items-center"
                  style={{
                    backgroundColor: rowBg,
                    border: `1px solid ${withAlpha(colors.border, 0.45)}`,
                    borderLeft: `5px solid ${leftBar}`,
                    borderRadius: `${scaled(radius.md, viewport, 4)}px`,
                    padding: `${scaled(8, viewport, 3)}px ${scaled(14, viewport, 5)}px`,
                    gap: `${scaled(14, viewport, 5)}px`,
                    opacity: isFinished ? 0.7 : 1,
                  }}
                >
                  <span
                    className="font-mono font-black shrink-0 text-right"
                    style={{
                      color: timeColor,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                      minWidth: scaled(64, viewport, 40),
                    }}
                  >
                    {cell.time}
                  </span>

                  <div
                    className="flex items-center min-w-0 shrink-0"
                    style={{ gap: `${scaled(6, viewport, 2)}px`, width: scaled(160, viewport, 100) }}
                  >
                    <span
                      className="rounded-full shrink-0"
                      style={{
                        backgroundColor: row.saunaAccent,
                        width: scaled(10, viewport, 7),
                        height: scaled(10, viewport, 7),
                      }}
                    />
                    <span
                      className="font-bold uppercase truncate"
                      style={{
                        color: isFinished ? withAlpha(colors.textSecondary, 0.5) : colors.textSecondary,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                        letterSpacing: '0.14em',
                      }}
                    >
                      {row.saunaName}
                    </span>
                  </div>

                  <span
                    className="font-black uppercase min-w-0 flex-1 truncate"
                    style={{
                      color: titleColor,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {cell.title}
                  </span>

                  <div className="flex shrink-0" style={{ gap: 2 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <FlameIcon
                        key={i}
                        size={scaled(12, viewport, 9)}
                        color={
                          i <= (cell.intensity ?? 1)
                            ? isFinished
                              ? withAlpha(colors.accentPrimary, 0.35)
                              : isOngoing
                                ? colors.statusLive
                                : colors.accentPrimary
                            : withAlpha(colors.accentPrimary, 0.2)
                        }
                        filled={i <= (cell.intensity ?? 1)}
                      />
                    ))}
                  </div>

                  <span
                    className="font-bold shrink-0"
                    style={{
                      color: withAlpha(colors.textSecondary, isFinished ? 0.4 : 0.7),
                      backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
                      border: `1px solid ${withAlpha(colors.border, 0.5)}`,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8)}px`,
                      padding: '2px 8px',
                      borderRadius: `${radius.pill}px`,
                      letterSpacing: '0.1em',
                    }}
                  >
                    {cell.durationMin} MIN
                  </span>

                  <div
                    className="shrink-0 text-center"
                    style={{ width: scaled(72, viewport, 50) }}
                  >
                    {isOngoing ? (
                      <span
                        className="font-black uppercase"
                        style={{
                          color: colors.textInverse,
                          backgroundColor: colors.statusLive,
                          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
                          padding: '3px 10px',
                          borderRadius: `${radius.pill}px`,
                          letterSpacing: '0.16em',
                        }}
                      >
                        LÄUFT
                      </span>
                    ) : isPrestart || isNext ? (
                      <span
                        className="font-black uppercase"
                        style={{
                          color: colors.textInverse,
                          backgroundColor: isPrestart ? colors.statusWarning : colors.statusNext,
                          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
                          padding: '3px 10px',
                          borderRadius: `${radius.pill}px`,
                          letterSpacing: '0.16em',
                        }}
                      >
                        GLEICH
                      </span>
                    ) : isFinished ? (
                      <span
                        className="font-black uppercase"
                        style={{
                          color: withAlpha(colors.textSecondary, 0.6),
                          backgroundColor: withAlpha(colors.border, 0.3),
                          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                          padding: '2px 8px',
                          borderRadius: `${radius.pill}px`,
                          letterSpacing: '0.16em',
                        }}
                      >
                        VORBEI
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </AutoScroll>
      )}
    </div>
  );
}
