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

interface SlotEntry {
  saunaId: string;
  saunaName: string;
  saunaAccent: string;
  cell: SchedulePanelCell;
}

function entriesForSlot(
  data: SchedulePanelData,
  slotIdx: number,
  tokens: SlideRendererProps<'content-panel'>['tokens'],
): SlotEntry[] {
  const entries: SlotEntry[] = [];
  data.saunas.forEach((sauna, saunaIdx) => {
    if (sauna.isOutOfOrder) return;
    const cell = data.cells[saunaIdx]?.[slotIdx] ?? null;
    if (!cell) return;
    entries.push({
      saunaId: sauna.id,
      saunaName: sauna.name,
      saunaAccent: saunaAccentFor(sauna, saunaIdx, tokens),
      cell,
    });
  });
  return entries;
}

/**
 * Wellness Timeline — content-panel renderer (legacy `modern-timeline`).
 *
 * Time-slots are the primary axis. For each slot the renderer emits a
 * row with the timestamp on a vertical rail and one tile per active
 * sauna (with intensity flames, duration badge, and live/next/finished
 * styling). Empty time slots are skipped so the layout stays dense
 * even on long opening hours.
 */
export function SchedulePanelRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'content-panel'>) {
  const { colors, typography, spacing, radius } = tokens;
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

  const slots = data.timeSlots
    .map((time, slotIdx) => ({ time, slotIdx, entries: entriesForSlot(data, slotIdx, tokens) }))
    .filter((slot) => slot.entries.length > 0);

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
          Aufgussplan · Timeline
        </span>
        <span
          className="font-semibold"
          style={{
            color: colors.textSecondary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
          }}
        >
          {slots.length} Slots
        </span>
      </div>

      <AutoScroll className="flex-1 min-h-0">
        <ol className="flex flex-col" style={{ gap: `${scaled(10, viewport, 4)}px` }}>
          {slots.map(({ time, slotIdx, entries }) => {
            const anyLive = entries.some((entry) => entry.cell.isLive);
            const anyNext = entries.some((entry) => entry.cell.isNext || entry.cell.isPrestart);
            const railColor = anyLive
              ? colors.statusLive
              : anyNext
                ? colors.statusNext
                : colors.accentSecondary;
            return (
              <li
                key={`${time}-${slotIdx}`}
                className="flex"
                style={{ gap: `${scaled(16, viewport, 5)}px` }}
              >
                <div
                  className="flex shrink-0 flex-col items-center"
                  style={{ width: scaled(76, viewport, 48) }}
                >
                  <span
                    className="font-mono font-black"
                    style={{
                      color: railColor,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {time}
                  </span>
                  <div
                    aria-hidden="true"
                    className="mt-1 grow"
                    style={{ width: 2, backgroundColor: withAlpha(railColor, 0.4) }}
                  />
                </div>

                <div
                  className="flex flex-1 flex-wrap"
                  style={{ gap: `${scaled(8, viewport, 3)}px` }}
                >
                  {entries.map((entry) => {
                    const cell = entry.cell;
                    const isLive = cell.isLive;
                    const isPrestart = cell.isPrestart === true;
                    const isFinished = cell.isFinished === true;
                    const isNext = cell.isNext;
                    const tileBg = isLive
                      ? withAlpha(colors.statusLive, 0.14)
                      : isPrestart
                        ? withAlpha(colors.statusWarning, 0.14)
                        : isNext
                          ? withAlpha(colors.statusNext, 0.14)
                          : isFinished
                            ? withAlpha(colors.surfaceElevated, 0.45)
                            : withAlpha(colors.surfaceElevated, 0.85);
                    const tileBorder = isLive
                      ? withAlpha(colors.statusLive, 0.4)
                      : isPrestart
                        ? withAlpha(colors.statusWarning, 0.4)
                        : isNext
                          ? withAlpha(colors.statusNext, 0.4)
                          : colors.border;
                    return (
                      <div
                        key={`${time}-${entry.saunaId}`}
                        className="flex flex-col"
                        style={{
                          backgroundColor: tileBg,
                          border: `1px solid ${tileBorder}`,
                          borderLeft: `4px solid ${entry.saunaAccent}`,
                          borderRadius: `${scaled(radius.md, viewport, 4)}px`,
                          padding: `${scaled(10, viewport, 4)}px ${scaled(12, viewport, 4)}px`,
                          gap: `${scaled(4, viewport, 1)}px`,
                          minWidth: scaled(220, viewport, 130),
                          flex: '1 1 220px',
                          opacity: isFinished ? 0.65 : 1,
                        }}
                      >
                        <span
                          className="font-bold uppercase"
                          style={{
                            color: colors.textSecondary,
                            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
                            letterSpacing: '0.14em',
                          }}
                        >
                          {entry.saunaName}
                        </span>

                        <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
                          <span
                            className="font-black uppercase truncate"
                            style={{
                              color: isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {cell.title}
                          </span>
                          <div className="flex shrink-0" style={{ gap: 2 }}>
                            {[1, 2, 3, 4].map((i) => (
                              <FlameIcon
                                key={i}
                                size={scaled(11, viewport, 8)}
                                color={
                                  i <= (cell.intensity ?? 1)
                                    ? isFinished
                                      ? withAlpha(colors.accentPrimary, 0.35)
                                      : isLive
                                        ? colors.statusLive
                                        : colors.accentPrimary
                                    : withAlpha(colors.accentPrimary, 0.2)
                                }
                                filled={i <= (cell.intensity ?? 1)}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between" style={{ gap: 6 }}>
                          {(cell.aromas?.length ?? 0) > 0 ? (
                            <div
                              className="flex flex-wrap min-w-0"
                              style={{ gap: 4 }}
                            >
                              {cell.aromas!.slice(0, 2).map((aroma) => (
                                <span
                                  key={aroma.id}
                                  className="inline-flex items-center font-bold uppercase"
                                  style={{
                                    color: aroma.color ?? colors.textSecondary,
                                    backgroundColor: withAlpha(aroma.color ?? colors.accentSecondary, 0.12),
                                    border: `1px solid ${withAlpha(aroma.color ?? colors.accentSecondary, 0.3)}`,
                                    borderRadius: `${radius.pill}px`,
                                    fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 7)}px`,
                                    padding: '1px 6px',
                                    gap: 3,
                                  }}
                                >
                                  {aroma.emoji ? <span>{aroma.emoji}</span> : null}
                                  <span>{aroma.name}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span />
                          )}
                          <span
                            className="font-bold shrink-0"
                            style={{
                              color: withAlpha(colors.textSecondary, isFinished ? 0.4 : 0.7),
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                              letterSpacing: '0.08em',
                            }}
                          >
                            {cell.durationMin} MIN
                          </span>
                        </div>

                        {isLive ? (
                          <span
                            className="self-start font-black uppercase"
                            style={{
                              color: colors.textInverse,
                              backgroundColor: colors.statusLive,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                              padding: '2px 8px',
                              borderRadius: `${radius.pill}px`,
                              letterSpacing: '0.18em',
                            }}
                          >
                            LÄUFT
                          </span>
                        ) : isPrestart || isNext ? (
                          <span
                            className="self-start font-black uppercase"
                            style={{
                              color: colors.textInverse,
                              backgroundColor: isPrestart ? colors.statusWarning : colors.statusNext,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                              padding: '2px 8px',
                              borderRadius: `${radius.pill}px`,
                              letterSpacing: '0.18em',
                            }}
                          >
                            GLEICH
                          </span>
                        ) : isFinished ? (
                          <span
                            className="self-start font-black uppercase"
                            style={{
                              color: withAlpha(colors.textSecondary, 0.6),
                              backgroundColor: withAlpha(colors.border, 0.3),
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                              padding: '2px 8px',
                              borderRadius: `${radius.pill}px`,
                              letterSpacing: '0.18em',
                            }}
                          >
                            VORBEI
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      </AutoScroll>
    </div>
  );
}
