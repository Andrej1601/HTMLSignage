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

/**
 * Compact stat chip — a single datum as `LABEL · value` (e.g.
 * "TEMP · 90 °C"). Three or four of these line up in a row without
 * eating the vertical budget the aufguss list needs. Replaces the
 * old `StatCell` stacked layout which blew up to 34px value text.
 */
function StatChip({
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
  const textSize = scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10);
  return (
    <span
      className="inline-flex items-baseline"
      style={{
        gap: scaled(6, viewport, 2),
        padding: `${scaled(4, viewport, 1)}px ${scaled(10, viewport, 4)}px`,
        borderRadius: 9999,
        border: `1px solid ${withAlpha(color, 0.4)}`,
        backgroundColor: withAlpha(color, 0.08),
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          ...kickerStyles(
            withAlpha(color, 0.8),
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.85, viewport, 8),
          ),
          letterSpacing: '0.2em',
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          color,
          fontFamily: typography.fontMono,
          fontSize: `${textSize}px`,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </span>
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
    { label: 'Temp', value: fmtTemperature(data.info.temperatureC) },
    { label: 'Feuchte', value: fmtHumidity(data.info.humidityPct) },
    {
      label: 'Plätze',
      value: data.info.capacity != null ? data.info.capacity.toString() : null,
    },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value));

  if (stats.length === 0) return null;

  return (
    <div
      className="flex flex-wrap"
      style={{ gap: `${scaled(6, viewport, 2)}px ${scaled(8, viewport, 3)}px` }}
    >
      {stats.map((stat) => (
        <StatChip
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
        // Compacted to give the list more breathing room on small
        // sauna-detail zones without sacrificing line-height comfort.
        padding: `${scaled(12, viewport, 5)}px 0`,
        gap: scaled(20, viewport, 8),
        opacity: isFinished ? 0.75 : 1,
      }}
    >
      <span
        className="shrink-0 tabular-nums"
        style={{
          color: timeColor,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleXl * 1.1, viewport, 14)}px`,
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: '-0.01em',
          minWidth: scaled(80, viewport, 46),
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
                    backgroundColor: withAlpha(color, isFinished ? 0.08 : 0.18),
                    border: `1px solid ${withAlpha(color, isFinished ? 0.35 : 0.7)}`,
                    // Text = ivory (textPrimary), not the aroma colour —
                    // guaranteed legible on the warm-charcoal backdrop.
                    color: isFinished
                      ? withAlpha(colors.textPrimary, 0.6)
                      : colors.textPrimary,
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
 *
 * Two contexts:
 *   - `onImage`: rendered over an image. Wraps the text in a brass-
 *     bordered glass card so the name is readable regardless of the
 *     image's luminance (the old textShadow-only approach lost the
 *     ivory text on light-coloured saunas).
 *   - otherwise: plain text on the panel — the itinerary backdrop
 *     already carries its own contrast.
 */
function SaunaMasthead({
  data,
  tokens,
  viewport,
  onImage = false,
  compact = false,
}: {
  data: SaunaDetailData;
  tokens: Tokens;
  viewport: Viewport;
  onImage?: boolean;
  /** If true, shrink scale so the masthead fits into a narrow header strip. */
  compact?: boolean;
}) {
  const { colors, typography, radius } = tokens;
  const accent = data.accentColor || colors.accentPrimary;
  const kickerColor = accent;
  // Sauna-detail name sits at the same typographic weight as the
  // Schedule / Events h1 so module headings read as a family. Was
  // scale3xl × 1.05 → ~50px; now scale2xl × 1.1 → ~37px.
  const nameScale = compact ? typography.scale2xl * 0.95 : typography.scale2xl * 1.1;
  const subtitleScale = compact ? typography.scaleSm * 1.05 : typography.scaleBase;

  const content = (
    <div className="flex flex-col min-w-0" style={{ gap: scaled(compact ? 4 : 8, viewport, 2) }}>
      <span
        style={kickerStyles(
          kickerColor,
          scaledFont(typography.baseSizePx * typography.scaleSm * 0.92, viewport, 9),
        )}
      >
        Aufguss-Fokus
      </span>
      <h2
        className="truncate"
        style={{
          color: colors.textPrimary,
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * nameScale, viewport, 18)}px`,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          margin: 0,
        }}
        title={data.name}
      >
        {data.name}
      </h2>
      {data.subtitle ? (
        <span
          className="truncate"
          style={eyebrowStyles(
            withAlpha(colors.textSecondary, 0.95),
            scaledFont(typography.baseSizePx * subtitleScale, viewport, 11),
            typography.fontHeading,
          )}
        >
          {data.subtitle}
        </span>
      ) : null}
    </div>
  );

  if (!onImage) return content;

  // On-image: wrap in a brass-bordered glass card so the name reads
  // against any background (dark stone, bright steam, etc.).
  return (
    <div
      className="flex flex-col min-w-0"
      style={{
        gap: scaled(compact ? 4 : 8, viewport, 2),
        padding: `${scaled(12, viewport, 5)}px ${scaled(16, viewport, 6)}px`,
        borderRadius: radius.md,
        border: `1px solid ${withAlpha(accent, 0.55)}`,
        backgroundColor: withAlpha(colors.surface, 0.72),
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 14px 34px ${withAlpha(colors.surface, 0.5)}`,
      }}
    >
      {content}
    </div>
  );
}

// ── Variant: Split ─────────────────────────────────────────────────────────
//
// Image left (3/5), itinerary right (2/5). The sauna name lives on the
// itinerary side where it reads cleanly against the dark panel, not
// over variable image luminance. The image carries only the LiveBadge —
// image luminance can't hide a single brass-bordered chip.

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
      {/* Image panel — clean, no overlaid text. Just the LiveBadge
          floating top-left so the viewer can see what's running right
          now without reading any text over the photo. */}
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
              style={{ filter: 'saturate(1.06) brightness(0.95)' }}
            />
            {/* Subtle brass frame glow — no bottom darkener now that
                no text sits on the image. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius: radius.lg,
                boxShadow: `inset 0 0 0 1px ${withAlpha(colors.accentPrimary, 0.2)}, inset 0 60px 120px ${withAlpha(colors.accentPrimary, 0.06)}`,
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
      </section>

      {/* Itinerary panel — sauna name + stats + list. Compact header so
          the aufguss list gets the vertical real estate it deserves. */}
      <section
        className="flex flex-col min-h-0"
        style={{
          padding: `${pad}px`,
          gap: scaled(spacing.sm, viewport, 4),
        }}
      >
        {/* Sauna name as the primary headline on the panel */}
        <SaunaMasthead
          data={data}
          tokens={tokens}
          viewport={viewport}
          compact={viewport.isCompact}
        />

        <StatRow data={data} tokens={tokens} viewport={viewport} />

        {data.info.features && data.info.features.length > 0 ? (
          <FeatureChips features={data.info.features} tokens={tokens} viewport={viewport} />
        ) : data.infoBadges.length > 0 ? (
          <FeatureChips features={data.infoBadges} tokens={tokens} viewport={viewport} />
        ) : null}

        {/* Aufguss-Liste header: compact one-liner — kicker + count */}
        <div
          className="flex items-baseline justify-between"
          style={{
            gap: scaled(12, viewport, 4),
            paddingTop: scaled(4, viewport, 1),
          }}
        >
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9),
            )}
          >
            Aufguss-Plan heute
          </span>
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.04em',
            }}
          >
            {data.upcoming.length} {data.upcoming.length === 1 ? 'Termin' : 'Termine'}
          </span>
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

// ── Variant: Hero ──────────────────────────────────────────────────────────
//
// Image occupies the top 55% of the stage as a pure hero; the bottom
// 45% is a brass-bordered aufguss panel carrying the full upcoming
// list. The old "floating now-card" design gave the aufgüsse barely
// two visible rows on a 16:9 display — this layout shows 4–6 depending
// on zone height without the image ever losing its dramatic billing.

function HeroVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const accent = data.accentColor || colors.accentPrimary;
  const pad = scaled(spacing.xl, viewport, 14);

  const liveOrNext =
    data.upcoming.find((e) => e.isLive) ?? data.upcoming.find((e) => !e.isFinished);

  // Hero image gets the top 40% (35% on compact zones), leaving the
  // bottom 60–65% for the aufguss list. Previous 55/45 split left
  // barely enough room for 3 aufgüsse on a 1080p wellness-stage.
  const imageHeight = viewport.isCompact ? '35%' : '40%';

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {/* Top: hero image */}
      <section
        className="relative shrink-0 overflow-hidden"
        style={{ height: imageHeight }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.06) brightness(0.9)' }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: auroraAmbientBackground(colors) }}
          />
        )}

        {/* Subtle bottom fade into the aufguss panel */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.0)} 60%, ${withAlpha(colors.surface, 0.85)} 100%)`,
          }}
        />

        {/* Live badge top-left */}
        {liveOrNext ? (
          <div
            className="absolute"
            style={{ top: pad, left: pad }}
          >
            <LiveBadge entry={liveOrNext} tokens={tokens} viewport={viewport} />
          </div>
        ) : null}

        {/* Sauna masthead bottom-left in a brass glass card so the
            name reads on any image. */}
        <div
          className="absolute"
          style={{
            left: pad,
            right: pad,
            bottom: pad,
            maxWidth: 620,
          }}
        >
          <SaunaMasthead
            data={data}
            tokens={tokens}
            viewport={viewport}
            onImage
            compact={viewport.isCompact}
          />
        </div>
      </section>

      {/* Bottom: aufguss panel with full list + compact chrome */}
      <section
        className="flex min-h-0 flex-1 flex-col"
        style={{
          padding: `${pad}px`,
          gap: scaled(spacing.sm, viewport, 3),
          background: auroraAmbientBackground(colors),
        }}
      >
        {/* Header row: kicker + stats + count */}
        <div
          className="flex flex-wrap items-center justify-between"
          style={{ gap: scaled(spacing.md, viewport, 6) }}
        >
          <div className="flex flex-col" style={{ gap: scaled(4, viewport, 1) }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9),
              )}
            >
              Aufguss-Plan heute
            </span>
            <span
              className="tabular-nums"
              style={{
                color: withAlpha(colors.textSecondary, 0.9),
                fontFamily: typography.fontMono,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
                letterSpacing: '0.04em',
              }}
            >
              {data.upcoming.length} {data.upcoming.length === 1 ? 'Termin' : 'Termine'}
            </span>
          </div>
          <StatRow data={data} tokens={tokens} viewport={viewport} />
        </div>

        {/* Feature chips just below the header row, if any */}
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
      {/* Upper image — 38% (was 52%). On portrait zones we want the
          aufguss list to command at least 60% so enough entries fit
          without the scroll immediately kicking in. */}
      <section
        className="relative shrink-0"
        style={{
          height: viewport.isCompact ? '36%' : '38%',
          margin: `${pad}px ${pad}px 0 ${pad}px`,
          borderRadius: radius.lg,
          overflow: 'hidden',
          border: `1px solid ${withAlpha(colors.border, 0.85)}`,
          boxShadow: `0 20px 48px ${withAlpha(colors.surface, 0.5)}`,
        }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.06) brightness(0.95)' }}
          />
        ) : (
          <EmptyImagePanel tokens={tokens} viewport={viewport} />
        )}

        {/* Subtle brass frame glow — no bottom-darkener needed now
            that the name sits on the panel below the image. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: radius.lg,
            boxShadow: `inset 0 0 0 1px ${withAlpha(colors.accentPrimary, 0.2)}`,
          }}
        />

        {liveOrNext ? (
          <div
            className="absolute"
            style={{
              top: scaled(16, viewport, 6),
              left: scaled(16, viewport, 6),
            }}
          >
            <LiveBadge entry={liveOrNext} tokens={tokens} viewport={viewport} />
          </div>
        ) : null}
      </section>

      {/* Lower itinerary — ~62%. Sauna name + stats in the header row,
          then the full list. Compact chrome so entries win the
          vertical budget. */}
      <section
        className="flex flex-1 min-h-0 flex-col"
        style={{
          padding: `${pad}px`,
          gap: scaled(spacing.sm, viewport, 4),
        }}
      >
        <SaunaMasthead
          data={data}
          tokens={tokens}
          viewport={viewport}
          compact
        />

        <StatRow data={data} tokens={tokens} viewport={viewport} />

        {data.info.features && data.info.features.length > 0 ? (
          <FeatureChips features={data.info.features} tokens={tokens} viewport={viewport} />
        ) : data.infoBadges.length > 0 ? (
          <FeatureChips features={data.infoBadges} tokens={tokens} viewport={viewport} />
        ) : null}

        {/* Compact list header — kicker + count on one line */}
        <div
          className="flex items-baseline justify-between"
          style={{ gap: scaled(12, viewport, 4), paddingTop: scaled(4, viewport, 1) }}
        >
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm * 0.9, viewport, 9),
            )}
          >
            Aufguss-Plan heute
          </span>
          <span
            className="tabular-nums"
            style={{
              color: withAlpha(colors.textSecondary, 0.85),
              fontFamily: typography.fontMono,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 9)}px`,
              letterSpacing: '0.04em',
            }}
          >
            {data.upcoming.length} {data.upcoming.length === 1 ? 'Termin' : 'Termine'}
          </span>
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
