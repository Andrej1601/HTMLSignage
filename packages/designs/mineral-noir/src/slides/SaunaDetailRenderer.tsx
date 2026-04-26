import type {
  SaunaDetailStyle,
  SaunaInfusionEntry,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — sauna-detail dispatcher.
 *
 *   split    — image left, upcoming list right (default)
 *   hero     — full-bleed image with floating info + infusion tiles
 *   portrait — image header, list below (tall zones)
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

// ── Shared bits ─────────────────────────────────────────────────────────────

function IntensityDots({
  level,
  color,
  muted,
  viewport,
}: {
  level: number;
  color: string;
  muted: string;
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const size = scaled(7, viewport, 3);
  return (
    <div
      className="flex items-center shrink-0"
      style={{ gap: scaled(4, viewport, 2) }}
      aria-label={`Intensität ${level} von 4`}
    >
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: i <= level ? color : 'transparent',
            border: `1px solid ${i <= level ? color : muted}`,
          }}
        />
      ))}
    </div>
  );
}

function statusFor(
  entry: SaunaInfusionEntry,
  tokens: SlideRendererProps<'sauna-detail'>['tokens'],
) {
  const { colors } = tokens;
  if (entry.isLive) return { color: colors.statusLive, label: 'LÄUFT' };
  if (entry.isPrestart) return { color: colors.statusWarning, label: 'GLEICH' };
  if (entry.isNext) return { color: colors.statusNext, label: 'GLEICH' };
  if (entry.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.7), label: 'VORBEI' };
  return null;
}

function InfusionRow({
  entry,
  first,
  tokens,
  viewport,
  onDark = false,
}: {
  entry: SaunaInfusionEntry;
  first: boolean;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
  onDark?: boolean;
}) {
  const { colors, typography } = tokens;
  const status = statusFor(entry, tokens);
  const isFinished = entry.isFinished;

  const baseTextColor = onDark ? colors.textPrimary : colors.textPrimary;
  const mutedTextColor = onDark
    ? withAlpha(colors.textSecondary, 0.85)
    : colors.textSecondary;
  const borderColor = onDark
    ? withAlpha(colors.textPrimary, 0.12)
    : withAlpha(colors.border, 0.8);

  const timeColor = entry.isLive
    ? colors.statusLive
    : entry.isPrestart
      ? colors.statusWarning
      : entry.isNext
        ? colors.statusNext
        : isFinished
          ? withAlpha(mutedTextColor, 0.7)
          : baseTextColor;

  const titleColor = isFinished
    ? withAlpha(baseTextColor, 0.55)
    : baseTextColor;

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${borderColor}` : 'none',
        borderBottom: `1px solid ${borderColor}`,
        padding: `${scaled(12, viewport, 5)}px 0`,
        gap: scaled(16, viewport, 6),
        opacity: isFinished ? 0.7 : 1,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
          letterSpacing: '0.02em',
          minWidth: scaled(84, viewport, 48),
          fontWeight: 500,
        }}
      >
        {entry.time}
      </span>

      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(2, viewport, 1) }}>
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          title={entry.title}
        >
          {entry.title}
        </span>
        {(entry.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={{
              color: mutedTextColor,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.9,
                viewport,
                8,
              )}px`,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            {entry.aromas!.slice(0, 3).map((a) => a.name).join(' · ')}
          </span>
        ) : null}
      </div>

      {/* Intensity column — fixed width, centered. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: scaled(72, viewport, 42) }}
      >
        {entry.intensity != null && entry.intensity > 0 ? (
          <IntensityDots
            level={entry.intensity}
            color={entry.isLive ? colors.statusLive : colors.accentPrimary}
            muted={withAlpha(mutedTextColor, 0.5)}
            viewport={viewport}
          />
        ) : null}
      </div>

      {/* Status column — fixed width, right-aligned. Reserves its
          slot even when empty so dots can't drift into it. */}
      <div
        className="shrink-0 flex items-center justify-end"
        style={{ width: scaled(78, viewport, 48) }}
      >
        {status ? (
          <span
            style={{
              color: status.color,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scaleSm * 0.78,
                viewport,
                7,
              )}px`,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {status.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatCell({
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
    <div className="flex flex-col" style={{ gap: scaled(4, viewport, 2) }}>
      <span
        className="tabular-nums"
        style={{
          color,
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
      <span
        style={labelStyles(
          withAlpha(color, 0.7),
          scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8),
        )}
      >
        {label}
      </span>
    </div>
  );
}

// ── Variant: Split ──────────────────────────────────────────────────────────

function SplitVariant({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        // Image:list = 2:3 (40% / 60%) statt 1:1 — gibt der Aufguss-Liste
        // die nötige Breite für Title + Aroma; das Bild bleibt dabei
        // immer noch eine vollwertige Bühne.
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)',
      }}
    >
      {/* Image panel */}
      <section className="relative overflow-hidden">
        {data.imageUrl ? (
          <>
            <img
              src={data.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: 'saturate(0.82) brightness(0.72)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(140deg, ${withAlpha(colors.surface, 0.2)} 0%, ${withAlpha(colors.surface, 0.55)} 100%)`,
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
        )}
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: scaled(16, viewport, 6) }}
        >
          <span style={labelStyles(colors.accentPrimary, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
            Sauna
          </span>
          <h2
            className="font-black"
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.1, viewport, 16)}px`,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              textShadow: data.imageUrl ? `0 2px 12px ${withAlpha(colors.surface, 0.9)}` : 'none',
            }}
          >
            {data.name}
          </h2>

          <div
            className="flex flex-wrap"
            style={{ gap: `${scaled(28, viewport, 10)}px ${scaled(24, viewport, 8)}px` }}
          >
            {data.info.temperatureC != null ? (
              <StatCell
                label="Temperatur"
                value={`${data.info.temperatureC}°C`}
                color={colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
            {data.info.humidityPct != null ? (
              <StatCell
                label="Feuchte"
                value={`${data.info.humidityPct}%`}
                color={colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
            {data.info.capacity != null ? (
              <StatCell
                label="Plätze"
                value={String(data.info.capacity)}
                color={colors.textPrimary}
                tokens={tokens}
                viewport={viewport}
              />
            ) : null}
          </div>
        </div>
      </section>

      {/* List panel */}
      <section
        className="flex min-h-0 flex-col"
        style={{ padding: `${pad}px`, gap: scaled(18, viewport, 7) }}
      >
        <div className="flex items-baseline justify-between shrink-0">
          <span style={labelStyles(colors.accentPrimary, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
            Aufgussplan
          </span>
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.1em',
            }}
          >
            {data.upcoming.length.toString().padStart(2, '0')} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: withAlpha(colors.textSecondary, 0.8),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Heute keine Aufgüsse
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col">
              {data.upcoming.map((entry, idx) => (
                <InfusionRow
                  key={entry.id}
                  entry={entry}
                  first={idx === 0}
                  tokens={tokens}
                  viewport={viewport}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </section>
    </div>
  );
}

// ── Variant: Hero ───────────────────────────────────────────────────────────

function HeroVariant({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);
  const accent = data.accentColor ?? colors.accentPrimary;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(0.75) brightness(0.6)' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
      )}
      {/* Deep vignette — tint from `heroOverlay`, intensity via
          `context.heroOverlayIntensity` (display slider). */}
      {(() => {
        const overlay = colors.heroOverlay ?? colors.surface;
        const k = context.heroOverlayIntensity ?? 1;
        const a = (base: number) => Math.max(0, Math.min(1, base * k));
        return (
          <>
            <div
              className="absolute inset-0"
              style={{ backgroundColor: withAlpha(overlay, a(0.55)) }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, ${withAlpha(overlay, a(0.2))} 0%, ${withAlpha(overlay, a(0.5))} 45%, ${withAlpha(overlay, a(0.88))} 100%)`,
              }}
            />
          </>
        );
      })()}

      {/* Top chrome: tag + name + stats row */}
      <div
        className="relative z-10 flex flex-col shrink-0"
        style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
      >
        <span style={labelStyles(accent, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
          Sauna
        </span>
        <h2
          className="font-black truncate"
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.25, viewport, 18)}px`,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
          }}
        >
          {data.name}
        </h2>
        <div className="flex flex-wrap" style={{ gap: scaled(24, viewport, 8) }}>
          {data.info.temperatureC != null ? (
            <StatCell
              label="Temperatur"
              value={`${data.info.temperatureC}°C`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.humidityPct != null ? (
            <StatCell
              label="Feuchte"
              value={`${data.info.humidityPct}%`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.capacity != null ? (
            <StatCell
              label="Plätze"
              value={String(data.info.capacity)}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>
      </div>

      {/* Bottom: frosted infusion tiles */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{ padding: `0 ${pad}px ${pad}px`, gap: scaled(10, viewport, 4) }}
      >
        <div
          className="flex items-baseline justify-between shrink-0"
          style={{ paddingBottom: scaled(4, viewport, 1) }}
        >
          <span style={labelStyles(accent, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
            Aufgussplan
          </span>
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.1em',
            }}
          >
            {data.upcoming.length.toString().padStart(2, '0')} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              border: `1px solid ${withAlpha(colors.border, 0.5)}`,
              borderRadius: radius.md,
              backgroundColor: withAlpha(colors.surfaceElevated, 0.45),
              backdropFilter: 'blur(14px) saturate(140%)',
              WebkitBackdropFilter: 'blur(14px) saturate(140%)',
            }}
          >
            Heute keine Aufgüsse
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col" style={{ gap: scaled(6, viewport, 2) }}>
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
  const status = statusFor(entry, tokens);
  const isFinished = entry.isFinished;

  const leftBar = entry.isLive
    ? colors.statusLive
    : entry.isPrestart
      ? colors.statusWarning
      : entry.isNext
        ? colors.statusNext
        : accent;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex items-center"
      style={{
        backgroundColor: withAlpha(colors.surfaceElevated, 0.55),
        backdropFilter: 'blur(16px) saturate(150%)',
        WebkitBackdropFilter: 'blur(16px) saturate(150%)',
        border: `1px solid ${withAlpha(colors.textPrimary, 0.1)}`,
        borderLeft: `2px solid ${leftBar}`,
        borderRadius: `${scaled(radius.md, viewport, 3)}px`,
        padding: `${scaled(12, viewport, 5)}px ${scaled(16, viewport, 6)}px`,
        gap: scaled(14, viewport, 5),
        opacity: isFinished ? 0.75 : 1,
        boxShadow: `0 6px 20px ${withAlpha(colors.surface, 0.4)}`,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: entry.isLive ? colors.statusLive : colors.textPrimary,
          fontFamily: typography.fontMono,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 12)}px`,
          fontWeight: 500,
          letterSpacing: '0.02em',
          minWidth: scaled(74, viewport, 44),
        }}
      >
        {entry.time}
      </span>
      <div className="flex flex-col flex-1 min-w-0" style={{ gap: scaled(2, viewport, 1) }}>
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          title={entry.title}
        >
          {entry.title}
        </span>
        {(entry.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={{
              color: withAlpha(colors.textSecondary, 0.9),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {entry.aromas!
              .slice(0, 3)
              .map((a) => (a.emoji ? `${a.emoji} ${a.name}` : a.name))
              .join(' · ')}
          </span>
        ) : null}
      </div>
      {/* Intensity column — fixed width, centered. Kept even when
          empty so dots across rows always hang from the same
          vertical line regardless of status presence. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: scaled(72, viewport, 42) }}
      >
        {entry.intensity != null && entry.intensity > 0 ? (
          <IntensityDots
            level={entry.intensity}
            color={entry.isLive ? colors.statusLive : accent}
            muted={withAlpha(colors.textSecondary, 0.4)}
            viewport={viewport}
          />
        ) : null}
      </div>

      {/* Status column — fixed width, right-aligned. Holds its slot
          even when empty so the intensity column can't drift right. */}
      <div
        className="shrink-0 flex items-center justify-end"
        style={{ width: scaled(78, viewport, 48) }}
      >
        {status ? (
          <span
            style={{
              color: status.color,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.78, viewport, 7)}px`,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {status.label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Variant: Portrait ───────────────────────────────────────────────────────

function PortraitVariant({
  data,
  tokens,
  context,
}: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.lg, viewport, 8);
  const accent = data.accentColor ?? colors.accentPrimary;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      <div className="relative" style={{ flex: '0 0 38%', overflow: 'hidden' }}>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.85) brightness(0.72)' }}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
        )}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '60%',
            background: `linear-gradient(to top, ${withAlpha(colors.surface, 0.95)} 0%, ${withAlpha(colors.surface, 0.2)} 100%)`,
          }}
        />
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: scaled(8, viewport, 3) }}
        >
          <span style={labelStyles(accent, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9))}>
            Sauna
          </span>
          <h2
            className="font-black truncate"
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.15, viewport, 16)}px`,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
            }}
            title={data.name}
          >
            {data.name}
          </h2>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
      >
        {/* Stats strip */}
        <div
          className="flex flex-wrap shrink-0"
          style={{ gap: scaled(22, viewport, 8) }}
        >
          {data.info.temperatureC != null ? (
            <StatCell
              label="Temperatur"
              value={`${data.info.temperatureC}°C`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.humidityPct != null ? (
            <StatCell
              label="Feuchte"
              value={`${data.info.humidityPct}%`}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
          {data.info.capacity != null ? (
            <StatCell
              label="Plätze"
              value={String(data.info.capacity)}
              color={colors.textPrimary}
              tokens={tokens}
              viewport={viewport}
            />
          ) : null}
        </div>

        <div className="flex items-baseline justify-between shrink-0">
          <span style={labelStyles(colors.accentPrimary, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
            Aufgussplan
          </span>
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.1em',
            }}
          >
            {data.upcoming.length.toString().padStart(2, '0')} Einträge
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: withAlpha(colors.textSecondary, 0.8),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Heute keine Aufgüsse
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col">
              {data.upcoming.map((entry, idx) => (
                <InfusionRow
                  key={entry.id}
                  entry={entry}
                  first={idx === 0}
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
