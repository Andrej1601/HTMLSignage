import type {
  SchedulePanelCell,
  SchedulePanelSauna,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { scaled, scaledFont } from './responsive';

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

function AlertTriangleIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

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

function IntensityFlames({
  level,
  size,
  activeColor,
  muted,
}: {
  level: number;
  size: number;
  activeColor: string;
  muted: boolean;
}) {
  return (
    <div className="flex" style={{ gap: 2 }}>
      {[1, 2, 3, 4].map((i) => (
        <FlameIcon
          key={i}
          size={size}
          color={
            i <= level
              ? muted
                ? withAlpha(activeColor, 0.45)
                : activeColor
              : 'rgba(120, 113, 108, 0.3)'
          }
          filled={i <= level}
        />
      ))}
    </div>
  );
}

function InfusionItemGrid({
  cell,
  tokens,
  viewport,
}: {
  cell: SchedulePanelCell;
  tokens: SlideRendererProps<'content-panel'>['tokens'];
  viewport: SlideRendererProps<'content-panel'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const isOngoing = cell.isLive;
  const isPrestart = cell.isPrestart === true;
  const isFinished = cell.isFinished === true;

  const containerBg = isOngoing
    ? withAlpha(colors.statusLive, 0.12)
    : isPrestart
      ? withAlpha(colors.statusWarning, 0.12)
      : isFinished
        ? withAlpha(colors.surfaceElevated, 0.45)
        : withAlpha(colors.surfaceElevated, 0.85);
  const containerBorder = isOngoing
    ? withAlpha(colors.statusLive, 0.35)
    : isPrestart
      ? withAlpha(colors.statusWarning, 0.35)
      : colors.border;
  const timeColor = isOngoing
    ? colors.statusLive
    : isPrestart
      ? colors.statusWarning
      : isFinished
        ? withAlpha(colors.textPrimary, 0.4)
        : colors.textPrimary;
  const titleColor = isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: containerBg,
        border: `1px solid ${containerBorder}`,
        borderRadius: `${scaled(radius.md, viewport, 5)}px`,
        padding: `${scaled(8, viewport, 4)}px ${scaled(12, viewport, 5)}px`,
        marginBottom: `${scaled(6, viewport, 2)}px`,
        gap: `${scaled(4, viewport, 2)}px`,
      }}
    >
      <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <span
          className="font-mono font-black"
          style={{
            color: timeColor,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            lineHeight: 1,
          }}
        >
          {cell.time}
        </span>
        <IntensityFlames
          level={cell.intensity ?? 1}
          size={scaled(11, viewport, 8)}
          activeColor={isOngoing ? colors.statusLive : colors.accentPrimary}
          muted={isFinished}
        />
      </div>
      <div className="flex items-baseline justify-between" style={{ gap: 8 }}>
        <span
          className="font-black uppercase truncate"
          style={{
            color: titleColor,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
            letterSpacing: '0.04em',
          }}
        >
          {cell.title}
        </span>
        {cell.durationMin != null ? (
          <span
            className="font-bold shrink-0"
            style={{
              color: withAlpha(colors.textSecondary, 0.7),
              backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
              padding: '2px 6px',
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.08em',
            }}
          >
            {cell.durationMin} MIN
          </span>
        ) : null}
      </div>
      {(cell.aromas?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap" style={{ gap: 4 }}>
          {cell.aromas!.slice(0, 2).map((aroma) => (
            <span
              key={aroma.id}
              className="inline-flex items-center font-bold uppercase"
              style={{
                color: aroma.color ?? colors.textSecondary,
                backgroundColor: withAlpha(aroma.color ?? colors.accentSecondary, 0.12),
                border: `1px solid ${withAlpha(aroma.color ?? colors.accentSecondary, 0.3)}`,
                borderRadius: `${tokens.radius.pill}px`,
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
      ) : null}
      {(isOngoing || isPrestart) ? (
        <span
          className="self-start font-black uppercase"
          style={{
            color: colors.textInverse,
            backgroundColor: isOngoing ? colors.statusLive : colors.statusWarning,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 7)}px`,
            padding: '2px 8px',
            borderRadius: `${radius.pill}px`,
            letterSpacing: '0.18em',
          }}
        >
          {isOngoing ? 'LÄUFT' : 'GLEICH'}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Wellness Classic — content-panel renderer.
 *
 * Restores the legacy `modern-wellness` look: each sauna gets its own
 * column with a header (name + temperature badge) and an auto-scrolling
 * list of its infusions. Long lists scroll inside their column instead
 * of pushing the layout. Out-of-order saunas dim their column.
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

  const columns = viewport.width > 0
    ? viewport.width < 480
      ? 1
      : viewport.width < 760
        ? 2
        : 3
    : 3;

  const visibleSaunas = data.saunas.slice(0, 6);
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
          {data.timeSlots.length} Slots · {visibleSaunas.length} Saunen
        </span>
      </div>

      <div
        className="grid flex-1 min-h-0"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: `${scaled(spacing.md, viewport, 4)}px`,
        }}
      >
        {visibleSaunas.map((sauna, idx) => {
          const accent = saunaAccentFor(sauna, idx, tokens);
          const cells = (data.cells[idx] ?? []).filter(
            (cell): cell is NonNullable<typeof cell> => cell !== null,
          );
          const isOOO = sauna.isOutOfOrder === true;

          return (
            <div
              key={sauna.id}
              className="flex flex-col min-h-0 relative overflow-hidden"
              style={{ opacity: isOOO ? 0.55 : 1 }}
            >
              <div
                className="flex items-center justify-between shrink-0"
                style={{
                  borderBottom: `2px solid ${withAlpha(colors.border, 0.7)}`,
                  paddingBottom: `${scaled(8, viewport, 3)}px`,
                  marginBottom: `${scaled(10, viewport, 4)}px`,
                  gap: `${scaled(8, viewport, 3)}px`,
                }}
              >
                <div className="flex items-center min-w-0" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
                  <div
                    className="rounded-full shrink-0"
                    style={{
                      width: scaled(7, viewport, 4),
                      height: scaled(24, viewport, 14),
                      background: `linear-gradient(to bottom, ${accent}, ${accent})`,
                    }}
                  />
                  <h3
                    className="font-black uppercase truncate"
                    style={{
                      color: colors.textPrimary,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
                      letterSpacing: '0.14em',
                    }}
                  >
                    {sauna.name}
                  </h3>
                </div>
                {!isOOO && sauna.temperatureC != null ? (
                  <span
                    className="font-bold inline-flex items-center shrink-0"
                    style={{
                      color: colors.accentPrimary,
                      backgroundColor: withAlpha(colors.surfaceElevated, 0.7),
                      border: `1px solid ${withAlpha(colors.border, 0.6)}`,
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                      padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
                      borderRadius: `${tokens.radius.pill}px`,
                      gap: 4,
                    }}
                  >
                    {sauna.temperatureC}°C
                  </span>
                ) : null}
              </div>

              {isOOO ? (
                <div
                  className="flex flex-1 flex-col items-center justify-center text-center"
                  style={{ color: colors.textSecondary }}
                >
                  <span className="mb-2"><AlertTriangleIcon size={24} color={colors.textSecondary} /></span>
                  <span
                    className="font-black uppercase"
                    style={{
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                      letterSpacing: '0.2em',
                    }}
                  >
                    Außer Betrieb
                  </span>
                </div>
              ) : cells.length === 0 ? (
                <div
                  className="flex flex-1 items-center justify-center text-center"
                  style={{ color: colors.textSecondary, opacity: 0.7 }}
                >
                  <span
                    className="font-black uppercase"
                    style={{
                      fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                      letterSpacing: '0.2em',
                    }}
                  >
                    Keine Aufgüsse
                  </span>
                </div>
              ) : (
                <AutoScroll className="flex-1 min-h-0">
                  <div className="flex flex-col">
                    {cells.map((cell) => (
                      <InfusionItemGrid
                        key={`${sauna.id}-${cell.time}-${cell.title}`}
                        cell={cell}
                        tokens={tokens}
                        viewport={viewport}
                      />
                    ))}
                  </div>
                </AutoScroll>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
