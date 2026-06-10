import type {
  IntensityDisplay,
  SaunaDetailStyle,
  SaunaInfusionEntry,
  SlideRendererProps,
} from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  IntensityMark,
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Photo-overlay text is conceptually a light-on-dark moment regardless
 * of the active theme. The pack's `textInverse` flips to dark on light
 * themes (correct for filled accent badges, wrong for photo overlays),
 * so we pin a brand-appropriate ivory here. Matches Editorial Resort's
 * dark-mode `textInverse` value.
 */
const PHOTO_TEXT_LIGHT = '#FAF4E8';

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

/**
 * Local wrapper around the shared `IntensityMark` — picks flames /
 * Roman based on the host's `intensityDisplay` preference.
 */
function SaunaIntensityMark({
  level,
  activeColor,
  idleColor,
  viewport,
  tokens,
  intensityDisplay,
}: {
  level: number;
  activeColor: string;
  idleColor: string;
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  intensityDisplay: IntensityDisplay;
}) {
  const { typography } = tokens;
  // Smaller flames match the row's visual rhythm — 24px was imbalanced
  // against a ~14px time label.
  const size = scaled(16, viewport, 10);
  return (
    <IntensityMark
      level={level}
      color={activeColor}
      idleColor={idleColor}
      size={size}
      display={intensityDisplay}
      fontFamily={typography.fontMono}
    />
  );
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

/**
 * Compact one-line stat — small-caps label + value on the same
 * baseline. Used inside the Portrait variant's image header where the
 * name already carries the hero weight and the stats are supporting
 * info (not a dashboard).
 */
function InlineStat({
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
  const { typography } = tokens;
  return (
    <span className="inline-flex items-baseline" style={{ gap: scaled(4, viewport, 1) }}>
      <span
        style={{
          ...kickerStyles(
            'rgba(255, 255, 255, 0.75)',
            scaledFont(typography.baseSizePx * typography.scaleSm * 0.82, viewport, 7),
          ),
          letterSpacing: '0.22em',
          textShadow: '0 1px 4px rgba(0,0,0,0.55)',
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          color: 'rgba(255, 255, 255, 0.98)',
          fontFamily: typography.fontHeading,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg * 0.95, viewport, 10)}px`,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          lineHeight: 1,
          textShadow: '0 1px 6px rgba(0,0,0,0.55)',
        }}
      >
        {value}
      </span>
    </span>
  );
}

function InfusionRow({
  entry,
  first,
  tokens,
  viewport,
  intensityDisplay,
}: {
  entry: SaunaInfusionEntry;
  first: boolean;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
  intensityDisplay: IntensityDisplay;
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
            mit{' '}
            {entry.aromas!
              .slice(0, 3)
              .map((a) => (a.emoji ? `${a.emoji} ${a.name}` : a.name))
              .join(', ')}
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
      {/* Fixed-width intensity column so all rows' flames line up
          vertically regardless of status presence. */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: scaled(90, viewport, 54) }}
      >
        {entry.intensity != null && entry.intensity > 0 ? (
          <SaunaIntensityMark
            level={entry.intensity}
            activeColor={entry.isLive ? colors.statusLive : colors.accentPrimary}
            idleColor={withAlpha(colors.accentPrimary, 0.2)}
            tokens={tokens}
            viewport={viewport}
            intensityDisplay={intensityDisplay}
          />
        ) : null}
      </div>
      {/* Fixed-width status column, reserves its slot even when empty. */}
      <div
        className="shrink-0 flex items-center justify-end"
        style={{ width: scaled(72, viewport, 42) }}
      >
        {status ? (
          <StatusWord
            label={status.label}
            color={status.color}
            tokens={tokens}
            viewport={viewport}
          />
        ) : null}
      </div>
    </div>
  );
}

// ── Variant: Split (magazine spread) ────────────────────────────────────────

function SplitVariant({ data, tokens, context }: SlideRendererProps<'sauna-detail'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);
  const accent = data.accentColor ?? colors.accentPrimary;
  const intensityDisplay = context.intensityDisplay ?? 'flames';

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        // Itinerary gets more room than the photograph — was 1.05/1
        // (≈ 51/49) which left the aufguss list cramped. Now 0.85/1.15
        // (≈ 42/58) so 6–8 entries fit without scrolling on a typical
        // 1080p wellness-stage zone.
        gridTemplateColumns: 'minmax(0, 0.85fr) minmax(0, 1.15fr)',
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
              PHOTO_TEXT_LIGHT,
              scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
            )}
          >
            Porträt
          </span>
          <h2
            style={{
              color: PHOTO_TEXT_LIGHT,
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
                color: withAlpha(PHOTO_TEXT_LIGHT, 0.92),
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
                  intensityDisplay={intensityDisplay}
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
  const intensityDisplay = context.intensityDisplay ?? 'flames';

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: PHOTO_TEXT_LIGHT,
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
      {/* Gentle editorial wash — paper feel on top half, darker at bottom for tiles.
          Tint from `heroOverlay`, intensity via
          `context.heroOverlayIntensity` (display slider). */}
      {(() => {
        const overlay = colors.heroOverlay ?? colors.textPrimary;
        const k = context.heroOverlayIntensity ?? 1;
        const a = (base: number) => Math.max(0, Math.min(1, base * k));
        return (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, ${withAlpha(overlay, a(0.2))} 0%, ${withAlpha(overlay, a(0.45))} 45%, ${withAlpha(overlay, a(0.8))} 100%)`,
            }}
          />
        );
      })()}

      {/* Top: kicker + serif headline */}
      <div
        className="relative z-10 shrink-0 flex flex-col"
        style={{ padding: `${pad}px`, gap: scaled(10, viewport, 4) }}
      >
        <span
          style={kickerStyles(
            PHOTO_TEXT_LIGHT,
            scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
          )}
        >
          Im Porträt · {data.name.length > 20 ? 'Sauna' : 'Unsere Sauna'}
        </span>
        <h2
          className="truncate"
          style={{
            color: PHOTO_TEXT_LIGHT,
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
          style={{ height: 1, backgroundColor: withAlpha(PHOTO_TEXT_LIGHT, 0.65), width: scaled(96, viewport, 44) }}
        />
        <div className="flex flex-wrap" style={{ gap: scaled(24, viewport, 8) }}>
          {data.info.temperatureC != null ? (
            <StatCell label="Temperatur" value={`${data.info.temperatureC}°C`} color={PHOTO_TEXT_LIGHT} tokens={tokens} viewport={viewport} />
          ) : null}
          {data.info.humidityPct != null ? (
            <StatCell label="Feuchte" value={`${data.info.humidityPct}%`} color={PHOTO_TEXT_LIGHT} tokens={tokens} viewport={viewport} />
          ) : null}
          {data.info.capacity != null ? (
            <StatCell label="Plätze" value={String(data.info.capacity)} color={PHOTO_TEXT_LIGHT} tokens={tokens} viewport={viewport} />
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
                withAlpha(PHOTO_TEXT_LIGHT, 0.92),
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
              color: PHOTO_TEXT_LIGHT,
              fontFamily: typography.fontHeading,
              fontStyle: 'italic',
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              backgroundColor: withAlpha(colors.surface, 0.3),
              backdropFilter: 'blur(12px) saturate(140%)',
              WebkitBackdropFilter: 'blur(12px) saturate(140%)',
              border: `1px solid ${withAlpha(PHOTO_TEXT_LIGHT, 0.25)}`,
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
                  intensityDisplay={intensityDisplay}
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
  intensityDisplay,
}: {
  entry: SaunaInfusionEntry;
  accent: string;
  tokens: SlideRendererProps<'sauna-detail'>['tokens'];
  viewport: SlideRendererProps<'sauna-detail'>['context']['viewport'];
  intensityDisplay: IntensityDisplay;
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
            mit{' '}
            {entry.aromas!
              .slice(0, 3)
              .map((a) => (a.emoji ? `${a.emoji} ${a.name}` : a.name))
              .join(', ')}
          </span>
        ) : null}
      </div>
      {entry.intensity != null && entry.intensity > 0 ? (
        <SaunaIntensityMark
          level={entry.intensity}
          activeColor={entry.isLive ? colors.statusLive : accent}
          idleColor={withAlpha(colors.accentPrimary, 0.2)}
          tokens={tokens}
          viewport={viewport}
          intensityDisplay={intensityDisplay}
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
  const intensityDisplay = context.intensityDisplay ?? 'flames';
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
      {/* Photograph header — sauna name + stats ride on the image
          so the body section below has the full vertical budget for
          the upcoming-list. Stats sit in a smaller serif size beneath
          the name. */}
      <div className="relative" style={{ flex: '0 0 38%', overflow: 'hidden' }}>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.95) brightness(0.8)' }}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: colors.surfaceElevated }} />
        )}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: '65%',
            background: `linear-gradient(to top, ${withAlpha(colors.textPrimary, 0.82)} 0%, transparent 100%)`,
          }}
        />
        <div
          className="relative z-10 flex h-full flex-col justify-end"
          style={{ padding: `${pad}px`, gap: scaled(6, viewport, 2) }}
        >
          <span
            style={{
              ...kickerStyles(
                PHOTO_TEXT_LIGHT,
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
              color: PHOTO_TEXT_LIGHT,
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
          {/* Stats row under the title — smaller font, same ivory on
              the dark gradient. "Temp · 90°C · Feuchte · 10% · Plätze · 12"
              style separator keeps it one line. */}
          {(data.info.temperatureC != null || data.info.humidityPct != null || data.info.capacity != null) ? (
            <div
              className="flex flex-wrap items-baseline"
              style={{
                gap: `${scaled(4, viewport, 1)}px ${scaled(14, viewport, 5)}px`,
                marginTop: scaled(2, viewport, 1),
              }}
            >
              {data.info.temperatureC != null ? (
                <InlineStat
                  label="Temp"
                  value={`${data.info.temperatureC}°C`}
                  tokens={tokens}
                  viewport={viewport}
                />
              ) : null}
              {data.info.humidityPct != null ? (
                <InlineStat
                  label="Feuchte"
                  value={`${data.info.humidityPct}%`}
                  tokens={tokens}
                  viewport={viewport}
                />
              ) : null}
              {data.info.capacity != null ? (
                <InlineStat
                  label="Plätze"
                  value={String(data.info.capacity)}
                  tokens={tokens}
                  viewport={viewport}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Body — stats moved up into the image, so this section is
          effectively all list (plus upcoming-list kicker). */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
      >

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
                  intensityDisplay={intensityDisplay}
                />
              ))}
            </div>
          </AutoScroll>
        )}
      </div>
    </div>
  );
}
