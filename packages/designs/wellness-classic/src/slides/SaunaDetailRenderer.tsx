import type {
  SaunaInfusionEntry,
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

/** Inline SVG flame — no icon-library dependency. */
function FlameIcon({ size, color, filled }: { size: number; color: string; filled: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 2.8-1 3-2.5.2-1.5-1-2.7-1-4.5a4 4 0 0 1 1.9-3.2A8 8 0 0 0 12 2a8 8 0 0 0-8 8c0 3.3 2 6 4.5 6.5" />
    </svg>
  );
}

function IntensityFlames({
  level,
  size,
  activeColor,
  idleColor,
}: {
  level: number;
  size: number;
  activeColor: string;
  idleColor: string;
}) {
  return (
    <div className="inline-flex items-center shrink-0" style={{ gap: Math.max(1, Math.round(size * 0.08)) }}>
      {[1, 2, 3, 4].map((i) => (
        <FlameIcon
          key={i}
          size={size}
          color={i <= level ? activeColor : idleColor}
          filled={i <= level}
        />
      ))}
    </div>
  );
}

function InfusionRow({
  entry,
  tokens,
  viewport,
}: {
  entry: SaunaInfusionEntry;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const isLive = entry.isLive;
  const isPre = entry.isPrestart;
  const isFinished = entry.isFinished;

  const statusColor = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isFinished
        ? colors.textSecondary
        : colors.textPrimary;

  const bg = isLive
    ? withAlpha(colors.statusLive, 0.12)
    : isPre
      ? withAlpha(colors.statusWarning, 0.12)
      : withAlpha(colors.surfaceElevated, 0.9);

  const borderColor = isLive
    ? withAlpha(colors.statusLive, 0.3)
    : isPre
      ? withAlpha(colors.statusWarning, 0.3)
      : colors.border;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: bg,
        borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
        border: `1px solid ${borderColor}`,
        padding: `${scaled(12, viewport, 6)}px`,
        gap: `${scaled(4, viewport, 2)}px`,
        opacity: isFinished ? 0.55 : 1,
      }}
    >
      <div className="flex items-baseline" style={{ gap: `${scaled(8, viewport, 4)}px` }}>
        <span
          className="font-mono font-black"
          style={{
            color: statusColor,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
            lineHeight: 1,
          }}
        >
          {entry.time}
        </span>
        <span
          className="font-bold uppercase flex-1 min-w-0"
          style={{
            color: isFinished ? colors.textSecondary : colors.textPrimary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            letterSpacing: '0.04em',
          }}
        >
          {entry.title}
        </span>
        {entry.intensity != null ? (
          <IntensityFlames
            level={entry.intensity}
            size={scaled(16, viewport, 9)}
            activeColor={isLive ? colors.statusLive : colors.accentPrimary}
            idleColor={withAlpha(colors.textSecondary, 0.35)}
          />
        ) : null}
        {isLive ? (
          <span
            className="font-black uppercase shrink-0"
            style={{
              color: colors.textInverse,
              backgroundColor: colors.statusLive,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
              padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.12em',
            }}
          >
            LÄUFT
          </span>
        ) : entry.isNext ? (
          <span
            className="font-black uppercase shrink-0"
            style={{
              color: colors.textInverse,
              backgroundColor: colors.statusNext,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
              padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
              borderRadius: `${radius.pill}px`,
              letterSpacing: '0.12em',
            }}
          >
            Gleich
          </span>
        ) : null}
      </div>

      {(entry.aromas?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap" style={{ gap: `${scaled(4, viewport, 2)}px` }}>
          {entry.aromas!.slice(0, 3).map((aroma) => (
            <span
              key={aroma.id}
              className="inline-flex items-center font-bold uppercase"
              style={{
                color: aroma.color ?? colors.textSecondary,
                backgroundColor: withAlpha(aroma.color ?? colors.accentSecondary, 0.12),
                border: `1px solid ${withAlpha(aroma.color ?? colors.accentSecondary, 0.3)}`,
                borderRadius: `${radius.pill}px`,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
                padding: `${scaled(2, viewport, 1)}px ${scaled(8, viewport, 3)}px`,
                gap: `${scaled(4, viewport, 2)}px`,
              }}
            >
              {aroma.emoji ? <span>{aroma.emoji}</span> : null}
              <span>{aroma.name}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wellness Classic — sauna-detail slide renderer.
 *
 * Structure is constant regardless of container size: image left,
 * infusion list right. Padding, font sizes and gaps scale down with
 * the viewport; long infusion lists auto-scroll rather than showing
 * a scrollbar.
 */
export function SaunaDetailRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, radius } = tokens;
  const { viewport } = context;

  const accent = data.accentColor ?? colors.accentPrimary;
  const pad = scaled(32, viewport, 8);
  const gap = scaled(16, viewport, 6);

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
      }}
    >
      <section className="relative flex flex-col overflow-hidden">
        {data.imageUrl ? (
          <>
            <img
              src={data.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(colors.textPrimary, 0.55)} 0%, ${withAlpha(
                  colors.textPrimary,
                  0.3,
                )} 55%, ${withAlpha(colors.surface, 0.9)} 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${withAlpha(accent, 0.18)} 0%, ${withAlpha(
                colors.surfaceElevated,
                0.35,
              )} 55%, ${colors.surface} 100%)`,
            }}
          />
        )}

        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: `${gap}px` }}
        >
          <div
            className="inline-flex items-center font-black uppercase"
            style={{
              alignSelf: 'flex-start',
              color: data.imageUrl ? colors.textInverse : colors.textPrimary,
              backgroundColor: withAlpha(accent, data.imageUrl ? 0.85 : 0.15),
              padding: `${scaled(4, viewport, 2)}px ${scaled(12, viewport, 4)}px`,
              borderRadius: `${radius.pill}px`,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.25em',
            }}
          >
            Sauna
          </div>

          <h2
            className="font-black"
            style={{
              color: data.imageUrl ? colors.textInverse : colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scale3xl * 1.25,
                viewport,
                16,
              )}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {data.name}
          </h2>

          {data.infoBadges.length > 0 ? (
            <div className="flex flex-wrap" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
              {data.infoBadges.slice(0, 2).map((badge, idx) => (
                <span
                  key={idx}
                  className="font-semibold"
                  style={{
                    color: data.imageUrl ? colors.textInverse : colors.textPrimary,
                    backgroundColor: withAlpha(
                      data.imageUrl ? colors.surfaceElevated : accent,
                      data.imageUrl ? 0.2 : 0.15,
                    ),
                    border: `1px solid ${withAlpha(
                      data.imageUrl ? colors.surfaceElevated : accent,
                      data.imageUrl ? 0.35 : 0.3,
                    )}`,
                    borderRadius: `${radius.md}px`,
                    padding: `${scaled(4, viewport, 2)}px ${scaled(8, viewport, 3)}px`,
                    fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 9)}px`,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap" style={{ gap: `${scaled(16, viewport, 6)}px` }}>
            {data.info.temperatureC != null ? (
              <Stat
                label="Temperatur"
                value={`${data.info.temperatureC}°C`}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
            {data.info.humidityPct != null ? (
              <Stat
                label="Feuchte"
                value={`${data.info.humidityPct}%`}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
            {data.info.capacity != null ? (
              <Stat
                label="Plätze"
                value={String(data.info.capacity)}
                color={data.imageUrl ? colors.textInverse : colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="flex min-h-0 flex-col overflow-hidden"
        style={{ padding: `${pad}px`, gap: `${gap}px` }}
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
            {data.upcoming.length} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: colors.textSecondary,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            }}
          >
            Heute keine Aufgüsse geplant.
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
              {data.upcoming.map((entry) => (
                <InfusionRow key={entry.id} entry={entry} tokens={tokens} viewport={viewport} />
              ))}
            </div>
          </AutoScroll>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  tokens,
  viewport,
}: {
  label: string;
  value: string;
  color: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { typography } = tokens;
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <span
        className="font-black uppercase"
        style={{
          color,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-semibold uppercase"
        style={{
          color,
          opacity: 0.75,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
          letterSpacing: '0.2em',
          marginTop: `${scaled(4, viewport, 1)}px`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
