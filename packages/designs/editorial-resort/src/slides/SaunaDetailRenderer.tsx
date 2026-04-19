import type {
  SaunaDetailStyle,
  SaunaInfusionEntry,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Editorial Resort — sauna-detail dispatcher.
 *
 *   split    — magazine spread (image left, itinerary right)
 *   hero     — cover story (full-bleed image + serif headline)
 *   portrait — feature article (image top, itinerary below)
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

// ── Shared ──────────────────────────────────────────────────────────────────

function statusMeta(
  entry: SaunaInfusionEntry,
  tokens: SlideRendererProps<'sauna-detail'>['tokens'],
) {
  const { colors } = tokens;
  if (entry.isLive) return { color: colors.statusLive, label: 'Läuft' };
  if (entry.isPrestart) return { color: colors.statusWarning, label: 'Gleich' };
  if (entry.isNext) return { color: colors.statusNext, label: 'Gleich' };
  if (entry.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.75), label: 'Vorbei' };
  return null;
}

function IntensityMark({
  level,
  color,
  viewport,
  tokens,
}: {
  level: number;
  color: string;
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
}) {
  const { typography } = tokens;
  const size = scaled(24, viewport, 14);
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1px solid ${color}`,
        color,
        fontFamily: typography.fontMono,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8)}px`,
        fontWeight: 600,
      }}
      aria-label={`Intensität ${level} von 4`}
    >
      {romanNumeral(level)}
    </span>
  );
}

function romanNumeral(n: number): string {
  switch (n) {
    case 1: return 'I';
    case 2: return 'II';
    case 3: return 'III';
    case 4: return 'IV';
    default: return '';
  }
}

function StatusWord({
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
  const { typography } = tokens;
  return (
    <span
      className="shrink-0"
      style={{
        color,
        fontFamily: typography.fontHeading,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
        fontStyle: 'italic',
        letterSpacing: '0.03em',
        fontWeight: 400,
      }}
    >
      {label}
    </span>
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
    <div className="flex flex-col" style={{ gap: scaled(6, viewport, 2) }}>
      <span
        className="tabular-nums"
        style={{
          color,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </span>
      <span
        style={kickerStyles(
          withAlpha(color, 0.7),
          scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 8),
        )}
      >
        {label}
      </span>
    </div>
  );
}

function InfusionRow({
  entry,
  first,
  tokens,
  viewport,
}: {
  entry: SaunaInfusionEntry;
  first: boolean;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  const status = statusMeta(entry, tokens);
  const isFinished = entry.isFinished;

  const timeColor = entry.isLive
    ? colors.statusLive
    : entry.isPrestart
      ? colors.statusWarning
      : entry.isNext
        ? colors.statusNext
        : isFinished
          ? withAlpha(colors.textSecondary, 0.7)
          : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? `1px solid ${colors.border}` : 'none',
        borderBottom: `1px solid ${colors.border}`,
        padding: `${scaled(16, viewport, 6)}px 0`,
        gap: scaled(20, viewport, 7),
        opacity: isFinished ? 0.75 : 1,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
          fontWeight: 500,
          lineHeight: 0.95,
          letterSpacing: '-0.01em',
          minWidth: scaled(100, viewport, 56),
        }}
      >
        {entry.time}
      </span>
      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(4, viewport, 2) }}>
        <span
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            lineHeight: 1.15,
          }}
          title={entry.title}
        >
          {entry.title}
        </span>
        {(entry.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.95),
              scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10),
              typography.fontHeading,
            )}
          >
            mit {entry.aromas!.slice(0, 3).map((a) => a.name).join(', ')}
          </span>
        ) : null}
      </div>
      {entry.durationMin != null ? (
        <span
          className="shrink-0 tabular-nums"
          style={{
            color: withAlpha(colors.textSecondary, 0.9),
            fontFamily: typography.fontMono,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
          }}
        >
          {entry.durationMin}′
        </span>
      ) : null}
      {entry.intensity != null && entry.intensity > 0 ? (
        <IntensityMark
          level={entry.intensity}
          color={entry.isLive ? colors.statusLive : colors.accentPrimary}
          tokens={tokens}
          viewport={viewport}
        />
      ) : null}
      {status ? (
        <div className="shrink-0" style={{ minWidth: scaled(68, viewport, 42), textAlign: 'right' }}>
          <StatusWord
            label={status.label}
            color={status.color}
            tokens={tokens}
            viewport={viewport}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Variant: Split (magazine spread) ────────────────────────────────────────

function SplitVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);
  const accent = data.accentColor ?? colors.accentPrimary;

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)',
      }}
    >
      {/* Left: photograph with serif title overlay */}
      <section className="relative overflow-hidden">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
        )}
        {/* Editorial gradient — keeps top clean for the photograph, fades down */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(colors.textPrimary, 0)} 0%, ${withAlpha(colors.textPrimary, 0.15)} 55%, ${withAlpha(colors.textPrimary, 0.65)} 100%)`,
          }}
        />
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: scaled(spacing.md, viewport, 7) }}
        >
          <span
            style={kickerStyles(
              colors.textInverse,
              scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
            )}
          >
            Aus der Saunawelt · Porträt
          </span>
          <h2
            style={{
              color: colors.textInverse,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.2, viewport, 20)}px`,
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              margin: 0,
              textShadow: `0 2px 14px ${withAlpha(colors.textPrimary, 0.75)}`,
            }}
          >
            {data.name}
          </h2>
          {data.description ? (
            <p
              style={{
                color: withAlpha(colors.textInverse, 0.92),
                fontFamily: typography.fontHeading,
                fontStyle: 'italic',
                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
                fontWeight: 400,
                letterSpacing: '0.005em',
                lineHeight: 1.35,
                margin: 0,
                maxWidth: '42ch',
                textShadow: `0 1px 8px ${withAlpha(colors.textPrimary, 0.7)}`,
              }}
            >
              {firstParagraph(data.description)}
            </p>
          ) : null}
          <div
            style={{ height: 1, backgroundColor: withAlpha(accent, 0.7), width: scaled(120, viewport, 60) }}
          />
        </div>
      </section>

      {/* Right: editorial itinerary */}
      <section
        className="flex min-h-0 flex-col"
        style={{ padding: `${pad}px`, gap: scaled(spacing.md, viewport, 7) }}
      >
        {/* Stats strip */}
        {(data.info.temperatureC != null || data.info.humidityPct != null || data.info.capacity != null) ? (
          <div
            className="flex flex-wrap shrink-0"
            style={{
              gap: scaled(28, viewport, 10),
              paddingBottom: scaled(spacing.md, viewport, 6),
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            {data.info.temperatureC != null ? (
              <StatCell label="Temperatur" value={`${data.info.temperatureC}°C`} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
            {data.info.humidityPct != null ? (
              <StatCell label="Feuchte" value={`${data.info.humidityPct}%`} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
            {data.info.capacity != null ? (
              <StatCell label="Plätze" value={String(data.info.capacity)} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
          </div>
        ) : null}

        {/* Masthead */}
        <div className="flex items-baseline justify-between shrink-0">
          <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
              )}
            >
              Heute in dieser Sauna
            </span>
            <h3
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Aufgussplan
            </h3>
          </div>
          <span
            className="tabular-nums"
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.85),
              scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10),
              typography.fontHeading,
            )}
          >
            {data.upcoming.length} {data.upcoming.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontHeading,
              fontStyle: 'italic',
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            }}
          >
            Heute keine Aufgüsse in dieser Sauna.
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

function firstParagraph(text: string): string {
  return text.split(/\n\n+/)[0] ?? text;
}

// ── Variant: Hero (cover story) ─────────────────────────────────────────────

function HeroVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);
  const accent = data.accentColor ?? colors.accentPrimary;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textInverse,
        fontFamily: typography.fontBody,
      }}
    >
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(0.92) brightness(0.78)' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
      )}
      {/* Gentle editorial wash — paper feel on top half, darker at bottom for tiles */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${withAlpha(colors.textPrimary, 0.2)} 0%, ${withAlpha(colors.textPrimary, 0.45)} 45%, ${withAlpha(colors.textPrimary, 0.8)} 100%)`,
        }}
      />

      {/* Top: kicker + serif headline */}
      <div
        className="relative z-10 shrink-0 flex flex-col"
        style={{ padding: `${pad}px`, gap: scaled(10, viewport, 4) }}
      >
        <span
          style={kickerStyles(
            colors.textInverse,
            scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
          )}
        >
          Im Porträt · {data.name.length > 20 ? 'Sauna' : 'Unsere Sauna'}
        </span>
        <h2
          className="truncate"
          style={{
            color: colors.textInverse,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.35, viewport, 22)}px`,
            fontWeight: 600,
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
            margin: 0,
            textShadow: `0 2px 14px ${withAlpha(colors.textPrimary, 0.7)}`,
          }}
        >
          {data.name}
        </h2>
        <div
          style={{ height: 1, backgroundColor: withAlpha(colors.textInverse, 0.65), width: scaled(96, viewport, 44) }}
        />
        <div className="flex flex-wrap" style={{ gap: scaled(24, viewport, 8) }}>
          {data.info.temperatureC != null ? (
            <StatCell label="Temperatur" value={`${data.info.temperatureC}°C`} color={colors.textInverse} tokens={tokens} viewport={viewport} />
          ) : null}
          {data.info.humidityPct != null ? (
            <StatCell label="Feuchte" value={`${data.info.humidityPct}%`} color={colors.textInverse} tokens={tokens} viewport={viewport} />
          ) : null}
          {data.info.capacity != null ? (
            <StatCell label="Plätze" value={String(data.info.capacity)} color={colors.textInverse} tokens={tokens} viewport={viewport} />
          ) : null}
        </div>
      </div>

      {/* Bottom: parchment slips (editorial glass tiles) */}
      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col"
        style={{ padding: `0 ${pad}px ${pad}px`, gap: scaled(10, viewport, 4) }}
      >
        <div
          className="flex items-baseline justify-between shrink-0"
          style={{ paddingBottom: scaled(6, viewport, 2) }}
        >
          <span
            style={{
              ...kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
              ),
              textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.7)}`,
            }}
          >
            Heutige Aufgüsse
          </span>
          <span
            className="tabular-nums"
            style={{
              ...eyebrowStyles(
                withAlpha(colors.textInverse, 0.92),
                scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10),
                typography.fontHeading,
              ),
              textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.7)}`,
            }}
          >
            {data.upcoming.length} {data.upcoming.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: colors.textInverse,
              fontFamily: typography.fontHeading,
              fontStyle: 'italic',
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              backgroundColor: withAlpha(colors.surface, 0.3),
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: `1px solid ${withAlpha(colors.textInverse, 0.25)}`,
              borderRadius: radius.md,
            }}
          >
            Heute keine Aufgüsse.
          </div>
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col" style={{ gap: scaled(6, viewport, 2) }}>
              {data.upcoming.map((entry) => (
                <HeroSlip
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

function HeroSlip({
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
  const status = statusMeta(entry, tokens);
  const isFinished = entry.isFinished;

  const leftBar = entry.isLive
    ? colors.statusLive
    : entry.isPrestart
      ? colors.statusWarning
      : entry.isNext
        ? colors.statusNext
        : accent;

  return (
    <div
      className="flex items-center"
      style={{
        backgroundColor: withAlpha(colors.surface, 0.88),
        border: `1px solid ${withAlpha(colors.textPrimary, 0.08)}`,
        borderLeft: `3px solid ${leftBar}`,
        borderRadius: radius.md,
        padding: `${scaled(14, viewport, 5)}px ${scaled(18, viewport, 7)}px`,
        gap: scaled(16, viewport, 6),
        opacity: isFinished ? 0.78 : 1,
        boxShadow: `0 8px 24px ${withAlpha(colors.textPrimary, 0.45)}`,
        color: colors.textPrimary,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: entry.isLive ? colors.statusLive : colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          minWidth: scaled(92, viewport, 52),
        }}
      >
        {entry.time}
      </span>
      <div className="flex flex-col flex-1 min-w-0" style={{ gap: scaled(4, viewport, 1) }}>
        <span
          className="truncate"
          style={{
            color: isFinished ? withAlpha(colors.textPrimary, 0.55) : colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
            fontWeight: 600,
            letterSpacing: '-0.005em',
          }}
          title={entry.title}
        >
          {entry.title}
        </span>
        {(entry.aromas?.length ?? 0) > 0 ? (
          <span
            className="truncate"
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.95),
              scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10),
              typography.fontHeading,
            )}
          >
            mit {entry.aromas!.slice(0, 3).map((a) => a.name).join(', ')}
          </span>
        ) : null}
      </div>
      {entry.intensity != null && entry.intensity > 0 ? (
        <IntensityMark
          level={entry.intensity}
          color={entry.isLive ? colors.statusLive : accent}
          tokens={tokens}
          viewport={viewport}
        />
      ) : null}
      {status ? (
        <StatusWord
          label={status.label}
          color={status.color}
          tokens={tokens}
          viewport={viewport}
        />
      ) : null}
    </div>
  );
}

// ── Variant: Portrait (feature article) ─────────────────────────────────────

function PortraitVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
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
      {/* Photograph header */}
      <div className="relative" style={{ flex: '0 0 38%', overflow: 'hidden' }}>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.95) brightness(0.85)' }}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
        )}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '55%',
            background: `linear-gradient(to top, ${withAlpha(colors.textPrimary, 0.75)} 0%, transparent 100%)`,
          }}
        />
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: scaled(6, viewport, 2) }}
        >
          <span
            style={{
              ...kickerStyles(
                colors.textInverse,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
              ),
              textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.6)}`,
            }}
          >
            Porträt
          </span>
          <h2
            className="truncate"
            style={{
              color: colors.textInverse,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.1, viewport, 16)}px`,
              fontWeight: 600,
              lineHeight: 0.95,
              letterSpacing: '-0.02em',
              margin: 0,
              textShadow: `0 2px 12px ${withAlpha(colors.textPrimary, 0.65)}`,
            }}
            title={data.name}
          >
            {data.name}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
      >
        {(data.info.temperatureC != null || data.info.humidityPct != null || data.info.capacity != null) ? (
          <div
            className="flex flex-wrap shrink-0"
            style={{
              gap: scaled(22, viewport, 8),
              paddingBottom: scaled(10, viewport, 4),
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            {data.info.temperatureC != null ? (
              <StatCell label="Temperatur" value={`${data.info.temperatureC}°C`} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
            {data.info.humidityPct != null ? (
              <StatCell label="Feuchte" value={`${data.info.humidityPct}%`} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
            {data.info.capacity != null ? (
              <StatCell label="Plätze" value={String(data.info.capacity)} color={colors.textPrimary} tokens={tokens} viewport={viewport} />
            ) : null}
          </div>
        ) : null}

        <div className="flex items-baseline justify-between shrink-0">
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
            )}
          >
            Heute in dieser Sauna
          </span>
          <span
            className="tabular-nums"
            style={eyebrowStyles(
              withAlpha(colors.textSecondary, 0.85),
              scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10),
              typography.fontHeading,
            )}
          >
            {data.upcoming.length} {data.upcoming.length === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        </div>

        {data.upcoming.length === 0 ? (
          <div
            className="flex flex-1 items-center justify-center"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontHeading,
              fontStyle: 'italic',
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            }}
          >
            Heute keine Aufgüsse.
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
