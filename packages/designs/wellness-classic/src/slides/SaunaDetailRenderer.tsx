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

/**
 * Inline SVG flame — closed path (Lucide-shape). The previous version
 * used an open path which the browser rendered as a half-crescent.
 */
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
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
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
    <div
      className="inline-flex items-center shrink-0"
      style={{ gap: Math.max(1, Math.round(size * 0.08)) }}
    >
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

/**
 * Status-badge variants used across the row. Matches the legacy
 * look: subtle tinted background + matching border + uppercase label.
 */
function StatusBadge({
  label,
  color,
  tokens,
  viewport,
}: {
  label: string;
  color: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { typography, radius } = tokens;
  return (
    <span
      className="font-black uppercase shrink-0"
      style={{
        color,
        backgroundColor: withAlpha(color, 0.15),
        border: `1px solid ${withAlpha(color, 0.3)}`,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
        padding: `${scaled(2, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
        borderRadius: `${radius.pill}px`,
        letterSpacing: '0.15em',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
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

  const bg = isLive
    ? withAlpha(colors.statusLive, 0.12)
    : isPre
      ? withAlpha(colors.statusWarning, 0.12)
      : isFinished
        ? withAlpha(colors.surfaceElevated, 0.45)
        : withAlpha(colors.surfaceElevated, 0.9);

  const borderColor = isLive
    ? withAlpha(colors.statusLive, 0.3)
    : isPre
      ? withAlpha(colors.statusWarning, 0.3)
      : colors.border;

  const timeColor = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isFinished
        ? withAlpha(colors.textPrimary, 0.35)
        : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  // Flames: grey-outlined when finished, coloured-filled otherwise.
  const flameActiveColor = isFinished
    ? withAlpha(colors.accentPrimary, 0.35)
    : isLive
      ? colors.statusLive
      : isPre
        ? colors.statusWarning
        : colors.accentPrimary;
  const flameIdleColor = withAlpha(colors.accentPrimary, 0.2);

  // Status badge config.
  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : isFinished
        ? { label: 'VORBEI', color: withAlpha(colors.textPrimary, 0.55) }
        : entry.isNext
          ? { label: 'GLEICH', color: colors.statusNext }
          : null;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: bg,
        borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
        border: `1px solid ${borderColor}`,
        padding: `${scaled(14, viewport, 6)}px ${scaled(16, viewport, 7)}px`,
        gap: `${scaled(6, viewport, 2)}px`,
      }}
    >
      {/* Row 1: time + status badge | flames */}
      <div className="flex items-center justify-between" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
        <div
          className="flex items-center min-w-0"
          style={{ gap: `${scaled(10, viewport, 4)}px` }}
        >
          <span
            className="font-mono font-black"
            style={{
              color: timeColor,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {entry.time}
          </span>
          {badge ? (
            <StatusBadge
              label={badge.label}
              color={badge.color}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>
        {entry.intensity != null ? (
          <IntensityFlames
            level={entry.intensity}
            size={scaled(16, viewport, 10)}
            activeColor={flameActiveColor}
            idleColor={flameIdleColor}
          />
        ) : null}
      </div>

      {/* Row 2: title | duration */}
      <div className="flex items-baseline justify-between" style={{ gap: `${scaled(8, viewport, 3)}px` }}>
        <span
          className="font-black uppercase min-w-0"
          style={{
            color: titleColor,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
            letterSpacing: '0.04em',
          }}
        >
          {entry.title}
        </span>
        <span
          className="font-black shrink-0"
          style={{
            color: withAlpha(colors.textSecondary, isFinished ? 0.45 : 0.7),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 8)}px`,
            letterSpacing: '0.08em',
          }}
        >
          {entry.durationMin} MIN
        </span>
      </div>

      {/* Row 3: aromas (optional) */}
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
                opacity: isFinished ? 0.6 : 1,
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
