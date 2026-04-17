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

interface TimeSlotEntry {
  saunaId: string;
  saunaName: string;
  cell: SchedulePanelCell;
}

function entriesPerSlot(data: SchedulePanelData, slotIdx: number): TimeSlotEntry[] {
  const entries: TimeSlotEntry[] = [];
  data.saunas.forEach((sauna, saunaIdx) => {
    const cell = data.cells[saunaIdx]?.[slotIdx] ?? null;
    if (!cell) return;
    entries.push({ saunaId: sauna.id, saunaName: sauna.name, cell });
  });
  return entries;
}

/**
 * Wellness Timeline — content-panel renderer.
 *
 * Time-slots are the primary axis. Each slot renders as a row with the
 * timestamp prominent on the left and every sauna that has an entry at
 * that slot inlined as horizontal "tiles". Empty slots are skipped, so
 * the layout stays dense even on long opening hours.
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
    .map((time, slotIdx) => ({ time, slotIdx, entries: entriesPerSlot(data, slotIdx) }))
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
          {slots.length} Slots · {data.saunas.length} Saunen
        </span>
      </div>

      <AutoScroll className="flex-1 min-h-0">
        <ol className="flex flex-col" style={{ gap: `${scaled(10, viewport, 4)}px` }}>
          {slots.map(({ time, slotIdx, entries }) => {
            const anyLive = entries.some((entry) => entry.cell.isLive);
            const anyNext = entries.some((entry) => entry.cell.isNext);
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
                  style={{ width: scaled(72, viewport, 44) }}
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
                    style={{
                      width: 2,
                      backgroundColor: withAlpha(railColor, 0.45),
                    }}
                  />
                </div>

                <div
                  className="flex flex-1 flex-wrap"
                  style={{ gap: `${scaled(8, viewport, 3)}px` }}
                >
                  {entries.map((entry) => {
                    const isLive = entry.cell.isLive;
                    const isNext = entry.cell.isNext;
                    const tileBg = isLive
                      ? withAlpha(colors.statusLive, 0.14)
                      : isNext
                        ? withAlpha(colors.statusNext, 0.14)
                        : withAlpha(colors.surfaceElevated, 0.85);
                    const tileBorder = isLive
                      ? withAlpha(colors.statusLive, 0.4)
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
                          borderRadius: `${scaled(radius.md, viewport, 4)}px`,
                          padding: `${scaled(8, viewport, 3)}px ${scaled(12, viewport, 4)}px`,
                          gap: `${scaled(2, viewport, 1)}px`,
                          minWidth: scaled(180, viewport, 110),
                          flex: '1 1 auto',
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
                        <div className="flex items-center justify-between" style={{ gap: 8 }}>
                          <span
                            className="font-black uppercase truncate"
                            style={{
                              color: colors.textPrimary,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {entry.cell.title}
                          </span>
                          {isLive ? (
                            <span
                              className="font-black uppercase shrink-0"
                              style={{
                                color: colors.textInverse,
                                backgroundColor: colors.statusLive,
                                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                                padding: '2px 6px',
                                borderRadius: `${radius.pill}px`,
                                letterSpacing: '0.16em',
                              }}
                            >
                              LÄUFT
                            </span>
                          ) : isNext ? (
                            <span
                              className="font-black uppercase shrink-0"
                              style={{
                                color: colors.textInverse,
                                backgroundColor: colors.statusNext,
                                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
                                padding: '2px 6px',
                                borderRadius: `${radius.pill}px`,
                                letterSpacing: '0.16em',
                              }}
                            >
                              GLEICH
                            </span>
                          ) : null}
                        </div>
                        {(entry.cell.aromas?.length ?? 0) > 0 ? (
                          <div
                            className="flex flex-wrap"
                            style={{
                              gap: 4,
                              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
                              color: colors.textSecondary,
                            }}
                          >
                            {entry.cell.aromas!.slice(0, 2).map((aroma) => (
                              <span key={aroma.id} className="inline-flex items-center gap-1">
                                {aroma.emoji ? <span>{aroma.emoji}</span> : null}
                                <span>{aroma.name}</span>
                              </span>
                            ))}
                          </div>
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
