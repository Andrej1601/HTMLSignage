import type {
  SaunaDetailStyle,
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
 * Status-badge — solid-filled pill with inverse text, matching the
 * legacy "VORBEI / GLEICH / LÄUFT" look from the ChronologicalList.
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
  const { typography, colors, radius } = tokens;
  return (
    <span
      className="font-black uppercase shrink-0"
      style={{
        color: colors.textInverse,
        backgroundColor: color,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
        padding: `${scaled(3, viewport, 2)}px ${scaled(12, viewport, 5)}px`,
        borderRadius: `${radius.pill}px`,
        letterSpacing: '0.18em',
        lineHeight: 1.3,
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
      : entry.isNext
        ? withAlpha(colors.statusNext, 0.12)
        : isFinished
          ? withAlpha(colors.surfaceElevated, 0.45)
          : withAlpha(colors.surfaceElevated, 0.9);

  const borderColor = isLive
    ? withAlpha(colors.statusLive, 0.3)
    : isPre
      ? withAlpha(colors.statusWarning, 0.3)
      : entry.isNext
        ? withAlpha(colors.statusNext, 0.3)
        : colors.border;

  const timeColor = isLive
    ? colors.statusLive
    : isPre || entry.isNext
      ? colors.statusWarning
      : isFinished
        ? withAlpha(colors.textPrimary, 0.35)
        : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  // Flames: muted when finished, coloured-filled otherwise.
  const flameActiveColor = isFinished
    ? withAlpha(colors.accentPrimary, 0.35)
    : isLive
      ? colors.statusLive
      : isPre || entry.isNext
        ? colors.statusWarning
        : colors.accentPrimary;
  const flameIdleColor = withAlpha(colors.accentPrimary, 0.2);

  // Status badge config (solid pill, shown in row 2 right-hand side).
  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : entry.isNext
        ? { label: 'GLEICH', color: colors.statusNext }
        : isFinished
          ? { label: 'VORBEI', color: withAlpha(colors.textPrimary, 0.55) }
          : null;

  const hasAromas = (entry.aromas?.length ?? 0) > 0;
  const hasSecondRow = hasAromas || badge !== null;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: bg,
        borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
        border: `1px solid ${borderColor}`,
        padding: `${scaled(14, viewport, 6)}px ${scaled(16, viewport, 7)}px`,
        gap: `${scaled(8, viewport, 3)}px`,
      }}
    >
      {/* Row 1: time + title | flames */}
      <div
        className="flex items-baseline justify-between"
        style={{ gap: `${scaled(12, viewport, 4)}px` }}
      >
        <div
          className="flex items-baseline min-w-0"
          style={{ gap: `${scaled(12, viewport, 4)}px` }}
        >
          <span
            className="font-mono font-black shrink-0"
            style={{
              color: timeColor,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {entry.time}
          </span>
          <span
            className="font-black uppercase min-w-0 truncate"
            style={{
              color: titleColor,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
              letterSpacing: '0.04em',
            }}
            title={entry.title}
          >
            {entry.title}
          </span>
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

      {/* Row 2: aromas (left) | badge (right) */}
      {hasSecondRow ? (
        <div
          className="flex items-center justify-between"
          style={{ gap: `${scaled(8, viewport, 3)}px` }}
        >
          {hasAromas ? (
            <div
              className="flex flex-wrap min-w-0"
              style={{ gap: `${scaled(4, viewport, 2)}px` }}
            >
              {entry.aromas!.slice(0, 3).map((aroma) => (
                <span
                  key={aroma.id}
                  className="inline-flex items-center font-bold uppercase"
                  style={{
                    color: aroma.color ?? colors.textSecondary,
                    backgroundColor: withAlpha(
                      aroma.color ?? colors.accentSecondary,
                      0.12,
                    ),
                    border: `1px solid ${withAlpha(
                      aroma.color ?? colors.accentSecondary,
                      0.3,
                    )}`,
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
          ) : (
            <span />
          )}
          {badge ? (
            <StatusBadge
              label={badge.label}
              color={badge.color}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Wellness Classic — sauna-detail renderer.
 *
 * Dispatches on `data.styleHint`:
 *   - `split`    → image left, upcoming infusion list right (default)
 *   - `hero`     → full-bleed image + floating info card overlay
 *   - `portrait` → image-dominant vertical layout (infusion list below)
 *
 * Unknown hints fall back to `split`. Every variant uses the pack's
 * tokens so tenant colour overrides flow through consistently.
 */
export function SaunaDetailRenderer(props: SlideRendererProps<'sauna-detail'>) {
  const hint: SaunaDetailStyle = props.data.styleHint ?? 'split';
  switch (hint) {
    case 'hero':
      return <HeroVariant {...props} />;
    case 'portrait':
      return <PortraitVariant {...props} />;
    case 'split':
    default:
      return <SplitVariant {...props} />;
  }
}

function SplitVariant({
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

// ────────────────────────────────────────────────────────────────────────
// Variant: Hero (cinematic, full-bleed image + overlay card)
// ────────────────────────────────────────────────────────────────────────
//
// Uses the sauna image full-bleed as the backdrop, with a gradient wash
// and a floating info card at the bottom holding: sauna name + subtitle,
// optional infusion "NOW PLAYING" highlight, temperature / humidity
// chips. Skips the full upcoming list — this variant is meant for
// focused attention, not data density.

function HeroVariant({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, radius } = tokens;
  const { viewport } = context;

  const accent = data.accentColor ?? colors.accentPrimary;
  const pad = scaled(24, viewport, 8);
  const gap = scaled(10, viewport, 4);

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textInverse,
        fontFamily: typography.fontBody,
      }}
    >
      {/* Background image / gradient */}
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${withAlpha(accent, 0.4)}, ${withAlpha(
              colors.surfaceElevated,
              0.8,
            )})`,
          }}
        />
      )}
      {/* Strong darken wash so glassmorphism tiles sit on a deeply
          fogged field. Two stacked layers: a base full-area shade and
          a stronger gradient from the tile zone downward. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: withAlpha(colors.textPrimary, 0.45) }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${withAlpha(
            colors.textPrimary,
            0.1,
          )} 0%, ${withAlpha(colors.textPrimary, 0.55)} 38%, ${withAlpha(
            colors.textPrimary,
            0.85,
          )} 100%)`,
        }}
      />

      {/* Top zone: Sauna tag + name + stats chips */}
      <div
        className="relative z-10 flex flex-col shrink-0"
        style={{ padding: `${pad}px`, gap: `${gap}px` }}
      >
        <div
          className="inline-flex items-center font-black uppercase"
          style={{
            alignSelf: 'flex-start',
            color: colors.textInverse,
            backgroundColor: withAlpha(accent, 0.9),
            padding: `${scaled(4, viewport, 2)}px ${scaled(12, viewport, 4)}px`,
            borderRadius: `${radius.pill}px`,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
            letterSpacing: '0.3em',
          }}
        >
          Sauna
        </div>
        <h2
          className="font-black truncate"
          style={{
            color: colors.textInverse,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(
              typography.baseSizePx * typography.scale3xl * 1.1,
              viewport,
              16,
            )}px`,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
          }}
        >
          {data.name}
        </h2>
        <div
          className="flex flex-wrap"
          style={{ gap: `${scaled(6, viewport, 2)}px` }}
        >
          {data.info.temperatureC != null ? (
            <HeroChip
              label="Temperatur"
              value={`${data.info.temperatureC}°C`}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.humidityPct != null ? (
            <HeroChip
              label="Feuchte"
              value={`${data.info.humidityPct}%`}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.capacity != null ? (
            <HeroChip
              label="Plätze"
              value={String(data.info.capacity)}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>
      </div>

      {/* Bottom zone: infusion tiles overlaid on image with glassmorphism */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{
          padding: `${scaled(6, viewport, 2)}px ${pad}px ${pad}px`,
          gap: `${scaled(8, viewport, 3)}px`,
        }}
      >
        <div
          className="flex items-baseline justify-between shrink-0"
          style={{ paddingInline: `${scaled(4, viewport, 1)}px` }}
        >
          <span
            className="font-black uppercase"
            style={{
              color: colors.textInverse,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.9,
                viewport,
                8,
              )}px`,
              letterSpacing: '0.3em',
              textShadow: `0 1px 2px ${withAlpha(colors.textPrimary, 0.5)}`,
            }}
          >
            Aufgussplan
          </span>
          <span
            className="font-semibold"
            style={{
              color: withAlpha(colors.textInverse, 0.85),
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.85,
                viewport,
                8,
              )}px`,
              textShadow: `0 1px 2px ${withAlpha(colors.textPrimary, 0.5)}`,
            }}
          >
            {data.upcoming.length} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: withAlpha(colors.surface, 0.4),
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${withAlpha(colors.textInverse, 0.2)}`,
              color: colors.textInverse,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
              fontWeight: 700,
            }}
          >
            Heute keine Aufgüsse geplant.
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col" style={{ gap: `${scaled(6, viewport, 2)}px` }}>
              {data.upcoming.map((entry) => (
                <HeroInfusionTile
                  key={entry.id}
                  entry={entry}
                  accent={accent}
                  tokens={tokens}
                  viewport={viewport}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </div>
    </div>
  );
}

function HeroInfusionTile({
  entry,
  accent,
  tokens,
  viewport,
}: {
  entry: SaunaInfusionEntry;
  accent: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  const isLive = entry.isLive;
  const isPre = entry.isPrestart;
  const isNext = entry.isNext;
  const isFinished = entry.isFinished;

  // Glassmorphism with stronger contrast: darker glass base + deeper
  // colour tint on status rows so tiles read clearly on any photo.
  const bg = isLive
    ? withAlpha(colors.statusLive, 0.55)
    : isPre
      ? withAlpha(colors.statusWarning, 0.5)
      : isNext
        ? withAlpha(colors.statusNext, 0.5)
        : isFinished
          ? withAlpha(colors.textPrimary, 0.45)
          : withAlpha(colors.textPrimary, 0.55);

  const border = isLive
    ? withAlpha(colors.statusLive, 0.9)
    : isPre
      ? withAlpha(colors.statusWarning, 0.75)
      : isNext
        ? withAlpha(colors.statusNext, 0.75)
        : withAlpha(colors.textInverse, 0.3);

  const leftBar = isLive
    ? colors.statusLive
    : isPre
      ? colors.statusWarning
      : isNext
        ? colors.statusNext
        : accent;

  const timeColor = isLive
    ? colors.textInverse
    : isPre || isNext
      ? colors.textInverse
      : isFinished
        ? withAlpha(colors.textInverse, 0.55)
        : colors.textInverse;
  const titleColor = isFinished ? withAlpha(colors.textInverse, 0.6) : colors.textInverse;

  const flameActive = isFinished
    ? withAlpha(colors.textInverse, 0.35)
    : isLive || isPre || isNext
      ? colors.textInverse
      : accent;
  const flameIdle = withAlpha(colors.textInverse, 0.2);

  const badge = isLive
    ? { label: 'LÄUFT', color: colors.statusLive }
    : isPre
      ? { label: 'GLEICH', color: colors.statusWarning }
      : isNext
        ? { label: 'GLEICH', color: colors.statusNext }
        : isFinished
          ? { label: 'VORBEI', color: withAlpha(colors.textInverse, 0.4) }
          : null;

  const hasAromas = (entry.aromas?.length ?? 0) > 0;
  const hasSecondRow = hasAromas || badge !== null;

  // Two-row layout for readability + larger proportions:
  //   Row 1: time + title (+ flames right)
  //   Row 2: aromas (+ status badge right)
  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: bg,
        backdropFilter: 'blur(14px) saturate(160%)',
        WebkitBackdropFilter: 'blur(14px) saturate(160%)',
        borderRadius: `${scaled(radius.lg, viewport, 6)}px`,
        border: `1px solid ${border}`,
        borderLeft: `${scaled(6, viewport, 3)}px solid ${leftBar}`,
        padding: `${scaled(14, viewport, 6)}px ${scaled(18, viewport, 7)}px`,
        gap: `${scaled(8, viewport, 3)}px`,
        opacity: isFinished ? 0.82 : 1,
        boxShadow: `0 10px 28px ${withAlpha(colors.textPrimary, 0.45)}`,
        color: colors.textInverse,
      }}
    >
      {/* Row 1 */}
      <div
        className="flex items-baseline justify-between"
        style={{ gap: `${scaled(12, viewport, 4)}px` }}
      >
        <div
          className="flex items-baseline min-w-0"
          style={{ gap: `${scaled(12, viewport, 4)}px` }}
        >
          <span
            className="font-mono font-black tabular-nums shrink-0"
            style={{
              color: timeColor,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              textShadow: `0 1px 3px ${withAlpha(colors.textPrimary, 0.6)}`,
            }}
          >
            {entry.time}
          </span>
          <span
            className="font-black uppercase truncate min-w-0"
            style={{
              color: titleColor,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              letterSpacing: '0.04em',
              textShadow: `0 1px 3px ${withAlpha(colors.textPrimary, 0.6)}`,
            }}
            title={entry.title}
          >
            {entry.title}
          </span>
        </div>
        {entry.intensity != null && entry.intensity > 0 ? (
          <IntensityFlames
            level={entry.intensity}
            size={scaled(16, viewport, 10)}
            activeColor={flameActive}
            idleColor={flameIdle}
          />
        ) : null}
      </div>

      {/* Row 2: aromas + badge */}
      {hasSecondRow ? (
        <div
          className="flex items-center justify-between"
          style={{ gap: `${scaled(8, viewport, 3)}px` }}
        >
          {hasAromas ? (
            <div
              className="flex flex-wrap min-w-0"
              style={{ gap: `${scaled(4, viewport, 2)}px` }}
            >
              {entry.aromas!.slice(0, 3).map((aroma) => (
                <span
                  key={aroma.id}
                  className="inline-flex items-center font-bold uppercase"
                  style={{
                    color: colors.textInverse,
                    backgroundColor: withAlpha(
                      aroma.color ?? colors.textInverse,
                      0.28,
                    ),
                    border: `1px solid ${withAlpha(
                      aroma.color ?? colors.textInverse,
                      0.55,
                    )}`,
                    borderRadius: `${radius.pill}px`,
                    fontSize: `${scaledFont(
                      typography.baseSizePx * typography.scaleSm,
                      viewport,
                      8,
                    )}px`,
                    padding: `${scaled(3, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
                    gap: `${scaled(4, viewport, 2)}px`,
                    opacity: isFinished ? 0.7 : 1,
                    textShadow: `0 1px 2px ${withAlpha(colors.textPrimary, 0.5)}`,
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
          {badge ? (
            <span
              className="font-black uppercase shrink-0"
              style={{
                color: colors.textInverse,
                backgroundColor: badge.color,
                fontSize: `${scaledFont(
                  typography.baseSizePx * typography.scaleSm * 0.9,
                  viewport,
                  8,
                )}px`,
                padding: `${scaled(3, viewport, 2)}px ${scaled(12, viewport, 5)}px`,
                borderRadius: `${radius.pill}px`,
                letterSpacing: '0.18em',
                boxShadow: `0 2px 6px ${withAlpha(colors.textPrimary, 0.35)}`,
              }}
            >
              {badge.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HeroChip({
  label,
  value,
  tokens,
  viewport,
}: {
  label: string;
  value: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { colors, typography, radius } = tokens;
  return (
    <div
      className="inline-flex items-baseline"
      style={{
        backgroundColor: withAlpha(colors.surface, 0.25),
        border: `1px solid ${withAlpha(colors.textInverse, 0.35)}`,
        borderRadius: `${radius.pill}px`,
        padding: `${scaled(5, viewport, 2)}px ${scaled(14, viewport, 5)}px`,
        gap: `${scaled(6, viewport, 2)}px`,
        color: colors.textInverse,
      }}
    >
      <span
        className="font-black"
        style={{
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        className="font-semibold uppercase"
        style={{
          opacity: 0.85,
          fontSize: `${scaledFont(
            typography.baseSizePx * typography.scaleSm * 0.9,
            viewport,
            7,
          )}px`,
          letterSpacing: '0.2em',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Variant: Portrait (image on top, compact data panel below)
// ────────────────────────────────────────────────────────────────────────
//
// Stacks the sauna image on the upper half of the zone with a data panel
// underneath. Tailored for tall / portrait-shaped zones where the split
// layout's horizontal 2-column arrangement would feel cramped.

function PortraitVariant({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, radius } = tokens;
  const { viewport } = context;

  const accent = data.accentColor ?? colors.accentPrimary;
  const pad = scaled(22, viewport, 8);
  const gap = scaled(14, viewport, 5);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {/* Image strip — ~38 % of the zone height. Keeps the infusion
          list (primary content for this variant) the majority of the
          vertical space while the image remains a strong header. */}
      <div
        className="relative"
        style={{ flex: '0 0 38%', overflow: 'hidden' }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(160deg, ${withAlpha(accent, 0.35)}, ${withAlpha(
                colors.surfaceElevated,
                0.7,
              )})`,
            }}
          />
        )}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '55%',
            background: `linear-gradient(to top, ${withAlpha(
              colors.textPrimary,
              0.75,
            )} 0%, transparent 100%)`,
          }}
        />
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: `${scaled(6, viewport, 2)}px` }}
        >
          <div
            className="inline-flex items-center font-black uppercase"
            style={{
              alignSelf: 'flex-start',
              color: colors.textInverse,
              backgroundColor: withAlpha(accent, 0.9),
              padding: `${scaled(3, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
              borderRadius: `${radius.pill}px`,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.9,
                viewport,
                8,
              )}px`,
              letterSpacing: '0.28em',
            }}
          >
            Sauna
          </div>
          <h2
            className="font-black"
            style={{
              color: colors.textInverse,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scale2xl * 1.15,
                viewport,
                16,
              )}px`,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {data.name}
          </h2>
        </div>
      </div>

      {/* Data panel */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ padding: `${pad}px`, gap: `${gap}px` }}
      >
        {/* Stats row */}
        <div
          className="flex flex-wrap"
          style={{ gap: `${scaled(18, viewport, 6)}px` }}
        >
          {data.info.temperatureC != null ? (
            <Stat
              label="Temperatur"
              value={`${data.info.temperatureC}°C`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.humidityPct != null ? (
            <Stat
              label="Feuchte"
              value={`${data.info.humidityPct}%`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.capacity != null ? (
            <Stat
              label="Plätze"
              value={String(data.info.capacity)}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>

        {/* Upcoming header */}
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
            <div
              className="flex flex-col"
              style={{ gap: `${scaled(6, viewport, 2)}px` }}
            >
              {data.upcoming.map((entry) => (
                <InfusionRow
                  key={entry.id}
                  entry={entry}
                  tokens={tokens}
                  viewport={viewport}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </div>
    </div>
  );
}
