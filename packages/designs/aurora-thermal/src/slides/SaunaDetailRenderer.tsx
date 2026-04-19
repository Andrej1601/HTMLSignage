import type {
  SaunaDetailData,
  SaunaDetailStyle,
  SaunaInfusionEntry,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
  romanNumeral,
  scaled,
  scaledFont,
  statusChipStyles,
  withAlpha,
} from './utils';

type Tokens = SlideRendererProps<'sauna-detail'>['tokens'];
type Viewport = SlideRendererProps<'sauna-detail'>['context']['viewport'];

/**
 * Aurora Thermal — sauna-detail dispatcher.
 *
 *   split    — image left (3/5) + itinerary right (2/5). The default.
 *   hero     — full-bleed image, floating brass "now"-card + micro list.
 *   portrait — image top (52%), itinerary bottom. For tall zones.
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

// ── Shared ─────────────────────────────────────────────────────────────────

function statusMeta(entry: SaunaInfusionEntry, tokens: Tokens) {
  const { colors } = tokens;
  if (entry.isLive) return { color: colors.statusLive, label: 'Jetzt' };
  if (entry.isPrestart) return { color: colors.statusWarning, label: 'Gleich' };
  if (entry.isNext) return { color: colors.statusNext, label: 'Als Nächstes' };
  if (entry.isFinished)
    return { color: withAlpha(colors.textSecondary, 0.65), label: 'Beendet' };
  return null;
}

function fmtTemperature(t?: number): string | null {
  if (t == null) return null;
  return `${Math.round(t)} °C`;
}

function fmtHumidity(h?: number): string | null {
  if (h == null) return null;
  return `${Math.round(h)} %`;
}

function IntensityMark({
  level,
  color,
  tokens,
  viewport,
  sizePx,
}: {
  level: number;
  color: string;
  tokens: Tokens;
  viewport: Viewport;
  sizePx?: number;
}) {
  const { typography } = tokens;
  const size = sizePx ?? scaled(30, viewport, 18);
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center tabular-nums"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `1px solid ${withAlpha(color, 0.65)}`,
        color,
        fontFamily: typography.fontMono,
        fontSize: `${Math.round(size * 0.38)}px`,
        fontWeight: 600,
        backgroundColor: withAlpha(color, 0.08),
      }}
      aria-label={`Intensität ${level} von 4`}
    >
      {romanNumeral(level)}
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
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { typography } = tokens;
  return (
    <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
      <span
        className="tabular-nums"
        style={{
          color,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 16)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </span>
      <span
        style={kickerStyles(
          withAlpha(color, 0.75),
          scaledFont(typography.baseSizePx * typography.scaleSm * 0.88, viewport, 8),
        )}
      >
        {label}
      </span>
    </div>
  );
}

function StatRow({
  data,
  tokens,
  viewport,
}: {
  data: SaunaDetailData;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors } = tokens;
  const accent = data.accentColor || colors.accentPrimary;
  const stats = [
    { label: 'Temperatur', value: fmtTemperature(data.info.temperatureC) },
    { label: 'Feuchte', value: fmtHumidity(data.info.humidityPct) },
    {
      label: 'Plätze',
      value: data.info.capacity != null ? data.info.capacity.toString() : null,
    },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  if (stats.length === 0) return null;

  return (
    <div
      className="flex"
      style={{
        gap: scaled(36, viewport, 14),
        paddingTop: scaled(10, viewport, 3),
        paddingBottom: scaled(10, viewport, 3),
      }}
    >
      {stats.map((stat) => (
        <StatCell
          key={stat.label}
          label={stat.label}
          value={stat.value}
          color={accent}
          tokens={tokens}
          viewport={viewport}
        />
      ))}
    </div>
  );
}

function FeatureChips({
  features,
  tokens,
  viewport,
}: {
  features: string[];
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography } = tokens;
  if (!features || features.length === 0) return null;
  return (
    <div
      className="flex flex-wrap"
      style={{ gap: `${scaled(6, viewport, 2)}px ${scaled(8, viewport, 3)}px` }}
    >
      {features.map((feature) => (
        <span
          key={feature}
          style={{
            padding: `${scaled(4, viewport, 1)}px ${scaled(12, viewport, 4)}px`,
            borderRadius: 9999,
            border: `1px solid ${withAlpha(colors.accentSecondary, 0.55)}`,
            backgroundColor: withAlpha(colors.accentSecondary, 0.12),
            color: withAlpha(colors.accentSecondary, 1),
            fontFamily: typography.fontBody,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
            fontWeight: 500,
            letterSpacing: '0.02em',
            lineHeight: 1.2,
          }}
        >
          {feature}
        </span>
      ))}
    </div>
  );
}

function InfusionRow({
  entry,
  tokens,
  viewport,
  accent,
  first = false,
}: {
  entry: SaunaInfusionEntry;
  tokens: Tokens;
  viewport: Viewport;
  accent: string;
  first?: boolean;
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
          ? withAlpha(colors.textSecondary, 0.55)
          : colors.textPrimary;

  const titleColor = isFinished
    ? withAlpha(colors.textPrimary, 0.55)
    : colors.textPrimary;

  const aromaList = (entry.aromas ?? []).slice(0, 4);

  return (
    <div
      className="flex items-baseline"
      style={{
        borderTop: first ? 'none' : `1px solid ${withAlpha(colors.border, 0.55)}`,
        padding: `${scaled(18, viewport, 7)}px 0`,
        gap: scaled(24, viewport, 9),
        opacity: isFinished ? 0.75 : 1,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 16)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          minWidth: scaled(94, viewport, 52),
          textShadow: entry.isLive
            ? `0 0 18px ${withAlpha(colors.statusLive, 0.35)}`
            : undefined,
        }}
      >
        {entry.time}
      </span>

      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: scaled(5, viewport, 2) }}>
        <h4
          className="truncate"
          style={{
            color: titleColor,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 13)}px`,
            fontWeight: 500,
            letterSpacing: '-0.005em',
            lineHeight: 1.15,
            margin: 0,
          }}
          title={entry.title}
        >
          {entry.title}
        </h4>
        {aromaList.length > 0 ? (
          <div
            className="flex flex-wrap items-center"
            style={{ gap: `${scaled(6, viewport, 2)}px ${scaled(8, viewport, 3)}px` }}
          >
            {aromaList.map((aroma) => {
              const color = aroma.color || accent;
              return (
                <span
                  key={aroma.id}
                  className="inline-flex items-center"
                  style={{
                    gap: scaled(5, viewport, 2),
                    padding: `${scaled(2, viewport, 1)}px ${scaled(9, viewport, 3)}px`,
                    borderRadius: 9999,
                    backgroundColor: withAlpha(color, isFinished ? 0.06 : 0.12),
                    border: `1px solid ${withAlpha(color, isFinished ? 0.28 : 0.48)}`,
                    color: withAlpha(color, isFinished ? 0.75 : 1),
                    fontFamily: typography.fontBody,
                    fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.92, viewport, 8)}px`,
                    fontWeight: 500,
                    letterSpacing: '0.02em',
                    lineHeight: 1.1,
                  }}
                >
                  {aroma.emoji ? <span aria-hidden>{aroma.emoji}</span> : null}
                  <span>{aroma.name}</span>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      {entry.intensity != null && entry.intensity > 0 ? (
        <IntensityMark
          level={entry.intensity}
          color={
            isFinished
              ? withAlpha(colors.accentPrimary, 0.4)
              : entry.isLive
                ? colors.statusLive
                : accent
          }
          tokens={tokens}
          viewport={viewport}
          sizePx={scaled(28, viewport, 16)}
        />
      ) : null}

      {status ? (
        <div
          className="shrink-0"
          style={{ minWidth: scaled(120, viewport, 66), textAlign: 'right' }}
        >
          <span
            style={statusChipStyles(status.color, {
              isLive: entry.isLive,
              sizePx: scaledFont(typography.baseSizePx * typography.scaleSm * 0.88, viewport, 8),
              fontFamily: typography.fontBody,
            })}
          >
            {entry.isLive ? (
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: status.color,
                  boxShadow: `0 0 10px ${withAlpha(status.color, 0.95)}`,
                }}
              />
            ) : null}
            {status.label}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Sauna masthead — brass kicker + large serif name + subtitle.
 * Shared by Split, Hero, Portrait so the name reads identically across.
 */
function SaunaMasthead({
  data,
  tokens,
  viewport,
  onImage = false,
}: {
  data: SaunaDetailData;
  tokens: Tokens;
  viewport: Viewport;
  onImage?: boolean;
}) {
  const { colors, typography } = tokens;
  const accent = data.accentColor || colors.accentPrimary;
  const nameColor = onImage ? colors.textPrimary : colors.textPrimary;
  const kickerColor = onImage ? colors.accentPrimary : accent;

  return (
    <div className="flex flex-col" style={{ gap: scaled(10, viewport, 3) }}>
      <span
        style={{
          ...kickerStyles(
            kickerColor,
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
          ),
          textShadow: onImage ? `0 1px 6px ${withAlpha(colors.surface, 0.7)}` : undefined,
        }}
      >
        Aufguss-Fokus
      </span>
      <h2
        style={{
          color: nameColor,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.15, viewport, 24)}px`,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          lineHeight: 0.95,
          margin: 0,
          textShadow: onImage ? `0 2px 14px ${withAlpha(colors.surface, 0.65)}` : undefined,
        }}
      >
        {data.name}
      </h2>
      {data.subtitle ? (
        <span
          style={{
            ...eyebrowStyles(
              withAlpha(colors.textSecondary, onImage ? 1 : 0.92),
              scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12),
              typography.fontHeading,
            ),
            textShadow: onImage ? `0 1px 6px ${withAlpha(colors.surface, 0.6)}` : undefined,
          }}
        >
          {data.subtitle}
        </span>
      ) : null}
    </div>
  );
}

// ── Variant: Split ─────────────────────────────────────────────────────────

function SplitVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const accent = data.accentColor || colors.accentPrimary;
  const pad = scaled(spacing.xl, viewport, 14);

  const liveOrNext =
    data.upcoming.find((e) => e.isLive) ?? data.upcoming.find((e) => !e.isFinished);

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        gridTemplateColumns: viewport.isNarrow ? '1fr' : '3fr 2fr',
      }}
    >
      {/* Image panel */}
      <section
        className="relative overflow-hidden"
        style={{
          margin: `${pad}px 0 ${pad}px ${pad}px`,
          borderRadius: radius.lg,
          border: `1px solid ${withAlpha(colors.border, 0.85)}`,
          boxShadow: `0 28px 60px ${withAlpha(colors.surface, 0.55)}`,
          backgroundColor: withAlpha(colors.surfaceElevated, 0.9),
        }}
      >
        {data.imageUrl ? (
          <>
            <img
              src={data.imageUrl}
              alt={data.name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: 'saturate(1.05) brightness(0.92)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.0)} 40%, ${withAlpha(colors.surface, 0.88)} 100%)`,
              }}
            />
            {/* Subtle brass frame glow */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: radius.lg,
                boxShadow: `inset 0 0 0 1px ${withAlpha(colors.accentPrimary, 0.18)}, inset 0 60px 120px ${withAlpha(colors.accentPrimary, 0.06)}`,
              }}
            />
          </>
        ) : (
          <EmptyImagePanel tokens={tokens} viewport={viewport} />
        )}

        {/* Live indicator floats top-left on the image */}
        {liveOrNext ? (
          <div
            className="absolute"
            style={{
              top: scaled(24, viewport, 10),
              left: scaled(24, viewport, 10),
            }}
          >
            <LiveBadge entry={liveOrNext} tokens={tokens} viewport={viewport} />
          </div>
        ) : null}

        {/* Masthead floats bottom-left */}
        <div
          className="absolute"
          style={{
            bottom: scaled(28, viewport, 12),
            left: scaled(28, viewport, 12),
            right: scaled(28, viewport, 12),
          }}
        >
          <SaunaMasthead data={data} tokens={tokens} viewport={viewport} onImage />
        </div>
      </section>

      {/* Itinerary panel */}
      <section
        className="flex flex-col min-h-0"
        style={{
          padding: `${pad}px`,
          gap: scaled(spacing.md, viewport, 8),
        }}
      >
        <div className="flex flex-col" style={{ gap: scaled(8, viewport, 3) }}>
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
            )}
          >
            Heute geplant
          </span>
          <div className="flex items-end justify-between" style={{ gap: scaled(12, viewport, 4) }}>
            <h3
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 18)}px`,
                fontWeight: 400,
                letterSpacing: '-0.015em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Aufguss-Plan
            </h3>
            <span
              className="tabular-nums"
              style={{
                color: withAlpha(colors.textSecondary, 0.85),
                fontFamily: typography.fontMono,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10)}px`,
                letterSpacing: '0.04em',
              }}
            >
              {data.upcoming.length} {data.upcoming.length === 1 ? 'Termin' : 'Termine'}
            </span>
          </div>
        </div>

        <StatRow data={data} tokens={tokens} viewport={viewport} />

        {data.info.features && data.info.features.length > 0 ? (
          <FeatureChips features={data.info.features} tokens={tokens} viewport={viewport} />
        ) : data.infoBadges.length > 0 ? (
          <FeatureChips features={data.infoBadges} tokens={tokens} viewport={viewport} />
        ) : null}

        <div style={brassHairline(colors, 1)} />

        {data.upcoming.length === 0 ? (
          <EmptyInfusions tokens={tokens} viewport={viewport} />
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col">
              {data.upcoming.map((entry, idx) => (
                <InfusionRow
                  key={entry.id}
                  entry={entry}
                  tokens={tokens}
                  viewport={viewport}
                  accent={accent}
                  first={idx === 0}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </section>
    </div>
  );
}

function LiveBadge({
  entry,
  tokens,
  viewport,
}: {
  entry: SaunaInfusionEntry;
  tokens: Tokens;
  viewport: Viewport;
}) {
  const { colors, typography, radius } = tokens;
  const status = statusMeta(entry, tokens);
  if (!status) return null;

  return (
    <div
      className="flex items-center"
      style={{
        gap: scaled(10, viewport, 4),
        padding: `${scaled(8, viewport, 3)}px ${scaled(14, viewport, 5)}px`,
        borderRadius: radius.pill,
        border: `1px solid ${withAlpha(status.color, 0.8)}`,
        backgroundColor: withAlpha(colors.surface, 0.7),
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: entry.isLive
          ? `0 0 24px ${withAlpha(status.color, 0.45)}`
          : `0 6px 24px ${withAlpha(colors.surface, 0.4)}`,
      }}
    >
      {entry.isLive ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: status.color,
            boxShadow: `0 0 14px ${withAlpha(status.color, 0.95)}`,
            animation: 'none',
          }}
        />
      ) : (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: withAlpha(status.color, 0.9),
          }}
        />
      )}
      <span
        style={{
          color: status.color,
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9)}px`,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        {status.label} · {entry.time} Uhr
      </span>
    </div>
  );
}

function EmptyImagePanel({ tokens, viewport }: { tokens: Tokens; viewport: Viewport }) {
  const { colors, typography } = tokens;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 30% 30%, ${withAlpha(colors.accentPrimary, 0.15)} 0%, transparent 60%), ${colors.surfaceElevated}`,
        color: withAlpha(colors.textSecondary, 0.75),
        fontFamily: typography.fontHeading,
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
        fontStyle: 'italic',
      }}
    >
      Ihre Saunawelt
    </div>
  );
}

function EmptyInfusions({ tokens, viewport }: { tokens: Tokens; viewport: Viewport }) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex flex-1 items-center justify-center flex-col"
      style={{
        gap: scaled(12, viewport, 4),
        padding: scaled(24, viewport, 10),
      }}
    >
      <div style={{ ...brassHairline(colors, 1), width: scaled(80, viewport, 40) }} />
      <span
        style={{
          color: withAlpha(colors.textSecondary, 0.85),
          fontFamily: typography.fontHeading,
          fontStyle: 'italic',
          fontWeight: 400,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          textAlign: 'center',
        }}
      >
        Heute keine weiteren Aufgüsse.
      </span>
    </div>
  );
}

// ── Variant: Hero ──────────────────────────────────────────────────────────

function HeroVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const accent = data.accentColor || colors.accentPrimary;
  const pad = scaled(spacing.xl, viewport, 14);

  const liveOrNext =
    data.upcoming.find((e) => e.isLive) ?? data.upcoming.find((e) => !e.isFinished);

  const shortListing = data.upcoming
    .filter((e) => !e.isFinished)
    .slice(0, viewport.isCompact ? 2 : 3);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt={data.name}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(1.06) brightness(0.82)' }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: auroraAmbientBackground(colors) }}
        />
      )}

      {/* Gradient vignette — warmer at the bottom to match the brass. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.25)} 0%, ${withAlpha(colors.surface, 0.0)} 30%, ${withAlpha(colors.surface, 0.55)} 65%, ${withAlpha(colors.surface, 0.95)} 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${withAlpha(colors.accentPrimary, 0.18)} 0%, transparent 70%)`,
        }}
      />

      {/* Top: live badge */}
      {liveOrNext ? (
        <div
          className="absolute"
          style={{ top: pad, left: pad }}
        >
          <LiveBadge entry={liveOrNext} tokens={tokens} viewport={viewport} />
        </div>
      ) : null}

      {/* Center-bottom: name + description */}
      <div
        className="absolute"
        style={{
          left: pad,
          right: pad,
          bottom: pad,
          display: 'flex',
          flexDirection: 'column',
          gap: scaled(20, viewport, 8),
        }}
      >
        <SaunaMasthead data={data} tokens={tokens} viewport={viewport} onImage />

        {/* The "now" card — brass bordered, glass-blurred */}
        {liveOrNext ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: scaled(10, viewport, 3),
              padding: `${scaled(20, viewport, 7)}px ${scaled(24, viewport, 9)}px`,
              borderRadius: radius.lg,
              border: `1px solid ${withAlpha(accent, 0.5)}`,
              backgroundColor: withAlpha(colors.surface, 0.55),
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: `0 24px 60px ${withAlpha(colors.surface, 0.6)}`,
              maxWidth: 720,
            }}
          >
            <div className="flex items-baseline" style={{ gap: scaled(18, viewport, 7) }}>
              <span
                className="tabular-nums"
                style={{
                  color: liveOrNext.isLive ? colors.statusLive : colors.textPrimary,
                  fontFamily: typography.fontHeading,
                  fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl, viewport, 20)}px`,
                  fontWeight: 400,
                  letterSpacing: '-0.02em',
                  lineHeight: 0.95,
                  textShadow: liveOrNext.isLive
                    ? `0 0 22px ${withAlpha(colors.statusLive, 0.35)}`
                    : undefined,
                }}
              >
                {liveOrNext.time}
              </span>
              <div className="flex flex-col min-w-0 flex-1" style={{ gap: scaled(4, viewport, 1) }}>
                <span
                  style={kickerStyles(
                    accent,
                    scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
                  )}
                >
                  {liveOrNext.isLive
                    ? 'Läuft gerade'
                    : liveOrNext.isNext
                      ? 'Als Nächstes'
                      : liveOrNext.isPrestart
                        ? 'Gleich'
                        : 'Geplant'}
                </span>
                <h3
                  style={{
                    color: colors.textPrimary,
                    fontFamily: typography.fontHeading,
                    fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 15)}px`,
                    fontWeight: 500,
                    letterSpacing: '-0.005em',
                    lineHeight: 1.1,
                    margin: 0,
                  }}
                >
                  {liveOrNext.title}
                </h3>
              </div>
              {liveOrNext.intensity != null && liveOrNext.intensity > 0 ? (
                <IntensityMark
                  level={liveOrNext.intensity}
                  color={liveOrNext.isLive ? colors.statusLive : accent}
                  tokens={tokens}
                  viewport={viewport}
                />
              ) : null}
            </div>

            {liveOrNext.aromas && liveOrNext.aromas.length > 0 ? (
              <div
                className="flex flex-wrap"
                style={{ gap: `${scaled(6, viewport, 2)}px ${scaled(8, viewport, 3)}px` }}
              >
                {liveOrNext.aromas.map((aroma) => {
                  const aromaColor = aroma.color || accent;
                  return (
                    <span
                      key={aroma.id}
                      className="inline-flex items-center"
                      style={{
                        gap: scaled(5, viewport, 2),
                        padding: `${scaled(3, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
                        borderRadius: 9999,
                        backgroundColor: withAlpha(aromaColor, 0.16),
                        border: `1px solid ${withAlpha(aromaColor, 0.5)}`,
                        color: aromaColor,
                        fontFamily: typography.fontBody,
                        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                        fontWeight: 500,
                      }}
                    >
                      {aroma.emoji ? <span aria-hidden>{aroma.emoji}</span> : null}
                      {aroma.name}
                    </span>
                  );
                })}
              </div>
            ) : null}

            {shortListing.length > 1 ? (
              <>
                <div style={{ ...brassHairline(colors, 1), opacity: 0.6 }} />
                <div className="flex flex-col" style={{ gap: scaled(6, viewport, 2) }}>
                  <span
                    style={kickerStyles(
                      withAlpha(colors.textSecondary, 0.8),
                      scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8),
                    )}
                  >
                    Im Anschluss
                  </span>
                  <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
                    {shortListing.slice(1).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-baseline"
                        style={{ gap: scaled(14, viewport, 5) }}
                      >
                        <span
                          className="shrink-0 tabular-nums"
                          style={{
                            color: withAlpha(colors.textPrimary, 0.85),
                            fontFamily: typography.fontMono,
                            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                            minWidth: scaled(62, viewport, 36),
                          }}
                        >
                          {entry.time}
                        </span>
                        <span
                          className="truncate"
                          style={{
                            color: withAlpha(colors.textPrimary, 0.85),
                            fontFamily: typography.fontHeading,
                            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 10)}px`,
                            fontWeight: 400,
                            lineHeight: 1.15,
                          }}
                        >
                          {entry.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Variant: Portrait ──────────────────────────────────────────────────────

function PortraitVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const accent = data.accentColor || colors.accentPrimary;
  const pad = scaled(spacing.xl, viewport, 14);

  const liveOrNext =
    data.upcoming.find((e) => e.isLive) ?? data.upcoming.find((e) => !e.isFinished);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {/* Upper image half */}
      <section
        className="relative shrink-0"
        style={{
          height: '52%',
          margin: `${pad}px ${pad}px 0 ${pad}px`,
          borderRadius: radius.lg,
          overflow: 'hidden',
          border: `1px solid ${withAlpha(colors.border, 0.85)}`,
          boxShadow: `0 22px 52px ${withAlpha(colors.surface, 0.55)}`,
        }}
      >
        {data.imageUrl ? (
          <>
            <img
              src={data.imageUrl}
              alt={data.name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: 'saturate(1.05) brightness(0.88)' }}
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.1)} 30%, ${withAlpha(colors.surface, 0.85)} 100%)`,
              }}
            />
          </>
        ) : (
          <EmptyImagePanel tokens={tokens} viewport={viewport} />
        )}

        {liveOrNext ? (
          <div
            className="absolute"
            style={{
              top: scaled(20, viewport, 8),
              left: scaled(20, viewport, 8),
            }}
          >
            <LiveBadge entry={liveOrNext} tokens={tokens} viewport={viewport} />
          </div>
        ) : null}

        <div
          className="absolute"
          style={{
            bottom: scaled(24, viewport, 10),
            left: scaled(24, viewport, 10),
            right: scaled(24, viewport, 10),
          }}
        >
          <SaunaMasthead data={data} tokens={tokens} viewport={viewport} onImage />
        </div>
      </section>

      {/* Lower itinerary half */}
      <section
        className="flex flex-1 min-h-0 flex-col"
        style={{
          padding: `${pad}px`,
          gap: scaled(spacing.md, viewport, 6),
        }}
      >
        <div
          className="flex items-end justify-between"
          style={{ gap: scaled(16, viewport, 6) }}
        >
          <div className="flex flex-col" style={{ gap: scaled(6, viewport, 2) }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 9),
              )}
            >
              Heute geplant
            </span>
            <h3
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 16)}px`,
                fontWeight: 400,
                letterSpacing: '-0.015em',
                lineHeight: 1,
                margin: 0,
              }}
            >
              Aufguss-Plan
            </h3>
          </div>
          <StatRow data={data} tokens={tokens} viewport={viewport} />
        </div>

        <div style={brassHairline(colors, 1)} />

        {data.upcoming.length === 0 ? (
          <EmptyInfusions tokens={tokens} viewport={viewport} />
        ) : (
          <AutoScroll className="flex-1 min-h-0">
            <div className="flex flex-col">
              {data.upcoming.map((entry, idx) => (
                <InfusionRow
                  key={entry.id}
                  entry={entry}
                  tokens={tokens}
                  viewport={viewport}
                  accent={accent}
                  first={idx === 0}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </section>
    </div>
  );
}
