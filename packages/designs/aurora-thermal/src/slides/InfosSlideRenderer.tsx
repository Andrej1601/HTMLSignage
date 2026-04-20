import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

type Viewport = SlideRendererProps<'infos'>['context']['viewport'];

/**
 * Aurora Thermal — infos renderer.
 *
 * Three layout modes. All three share one invariant: the body text is
 * wrapped in an `AutoScroll` so long copy gently pans vertically
 * inside whatever room the zone actually provides. Earlier versions
 * just clipped with `overflow: hidden`, which meant a compact split-
 * view zone could cut off the second half of an info's paragraph.
 *
 *   - background image → full-bleed photo; text lives in a brass-
 *                        bordered glass card at the bottom-left so
 *                        contrast survives any image luminance
 *   - side image       → 55/45 split, editorial column left, framed
 *                        photograph right; stacks to 1 column on
 *                        narrow zones so the text always has room
 *   - no image         → centred editorial column on the ambient
 *                        background; brass corner ornaments give it
 *                        weight without relying on a photo
 *
 * Contrast rule: body copy is rendered at full `textPrimary` alpha
 * across all three modes. The previous 0.92–0.95 multiplier was too
 * dim on the warm-charcoal surface and triggered legibility
 * complaints from the floor.
 */
export function InfosSlideRenderer({ data, tokens, context }: SlideRendererProps<'infos'>) {
  const { colors, typography, spacing, radius } = tokens;
  const { viewport } = context;
  const accent = data.accentColor ?? colors.accentPrimary;

  // Padding adapts: a 64px outer margin on a 400×300 zone eats half
  // the canvas. We scale the outer pad down aggressively on compact
  // zones so there's real room for the headline + body.
  const pad = viewport.isUltraCompact
    ? scaled(16, viewport, 8)
    : viewport.isCompact
      ? scaled(24, viewport, 10)
      : scaled(spacing.xl, viewport, 14);

  // Heading & body scales — sized so a 3-line headline + a few
  // paragraphs of body still fit comfortably on common zones. On
  // compact zones we give the body a head start by dropping the
  // heading a notch.
  const headingScale = viewport.isUltraCompact
    ? typography.scale2xl
    : viewport.isCompact
      ? typography.scale3xl * 0.95
      : typography.scale3xl * 1.15;
  const bodyScale = viewport.isUltraCompact
    ? typography.scaleBase
    : viewport.isCompact
      ? typography.scaleLg
      : typography.scaleLg * 1.08;

  // ── Mode: background ────────────────────────────────────────────────────
  if (data.imageMode === 'background' && data.imageUrl) {
    const cardMaxWidth = viewport.isCompact ? '92%' : '80%';
    return (
      <div
        className="relative flex h-full w-full flex-col justify-end overflow-hidden"
        style={{
          backgroundColor: colors.surface,
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
        }}
      >
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(1.06) brightness(0.72)' }}
        />
        {/* Vignette — stronger at the bottom so the glass card sits on
            a guaranteed-dark region no matter what the photo shows. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.3)} 0%, ${withAlpha(colors.surface, 0.0)} 30%, ${withAlpha(colors.surface, 0.7)} 65%, ${withAlpha(colors.surface, 0.97)} 100%)`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${withAlpha(accent, 0.2)} 0%, transparent 70%)`,
          }}
        />

        {/* Text lives in a brass-bordered glass card — guarantees
            contrast regardless of image luminance. Card height is
            capped to 75% of the zone so there's always a visible slice
            of the photograph even on a tiny split zone. */}
        <div
          className="relative z-10 flex min-h-0 flex-col"
          style={{
            margin: `${pad}px`,
            padding: `${scaled(18, viewport, 8)}px ${scaled(24, viewport, 10)}px`,
            borderRadius: radius.lg,
            border: `1px solid ${withAlpha(accent, 0.5)}`,
            backgroundColor: withAlpha(colors.surface, 0.82),
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: `0 22px 52px ${withAlpha(colors.surface, 0.55)}`,
            gap: scaled(12, viewport, 4),
            maxWidth: cardMaxWidth,
            maxHeight: '75%',
          }}
        >
          <div className="flex shrink-0 flex-col" style={{ gap: scaled(10, viewport, 3) }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 10),
              )}
            >
              Aus der Saunawelt
            </span>
            <h2
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * headingScale, viewport, 20)}px`,
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: viewport.isCompact ? 2 : 3,
              }}
            >
              {data.title}
            </h2>
            <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 52) }} />
          </div>
          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontBody,
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                maxWidth: 820,
                margin: 0,
              }}
            >
              {data.text}
            </p>
          </AutoScroll>
        </div>
      </div>
    );
  }

  // ── Mode: side image ────────────────────────────────────────────────────
  // Stack vertically on narrow OR compact zones so the text always
  // gets a full-width column to breathe in.
  const hasSideImage = Boolean(data.imageUrl) && data.imageMode === 'side';
  const stackVertical = hasSideImage && (viewport.isNarrow || viewport.isCompact);

  if (hasSideImage && !stackVertical) {
    return (
      <div
        className="grid h-full w-full overflow-hidden"
        style={{
          background: auroraAmbientBackground(colors),
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
          gridTemplateColumns: '55fr 45fr',
        }}
      >
        <section
          className="flex min-h-0 flex-col justify-center min-w-0"
          style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
        >
          <div className="flex shrink-0 flex-col" style={{ gap: scaled(14, viewport, 5) }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 10),
              )}
            >
              Aus der Saunawelt
            </span>
            <h2
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * headingScale, viewport, 18)}px`,
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {data.title}
            </h2>
            <div style={{ ...brassHairline(colors, 1), width: scaled(140, viewport, 60) }} />
          </div>
          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: colors.textPrimary,
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                maxWidth: 680,
                margin: 0,
                textWrap: 'pretty' as React.CSSProperties['textWrap'],
              }}
            >
              {data.text}
            </p>
          </AutoScroll>
          <span
            style={eyebrowStyles(
              withAlpha(colors.textPrimary, 0.75),
              scaledFont(typography.baseSizePx * typography.scaleBase, viewport, 10),
              typography.fontHeading,
            )}
          >
            Ihre Saunawelt
          </span>
        </section>

        <section
          className="relative overflow-hidden"
          style={{
            margin: `${pad}px ${pad}px ${pad}px 0`,
            borderRadius: radius.lg,
            border: `1px solid ${withAlpha(colors.border, 0.85)}`,
            boxShadow: `0 22px 52px ${withAlpha(colors.surface, 0.55)}`,
          }}
        >
          <img
            src={data.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.06) brightness(0.98)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: radius.lg,
              boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.22)}, inset 0 -80px 120px ${withAlpha(colors.surface, 0.2)}`,
            }}
          />
        </section>
      </div>
    );
  }

  // ── Mode: side-image stacked OR no-image ───────────────────────────────
  // Vertical column layout. When `stackVertical` is true we show the
  // image on top (38%), text below. Otherwise: ambient backdrop with
  // brass corner ornaments and a centred editorial column.
  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
      }}
    >
      {stackVertical && data.imageUrl ? (
        <section
          className="relative shrink-0 overflow-hidden"
          style={{
            height: viewport.isUltraCompact ? '28%' : '36%',
            margin: `${pad}px ${pad}px 0 ${pad}px`,
            borderRadius: radius.md,
            border: `1px solid ${withAlpha(colors.border, 0.85)}`,
            boxShadow: `0 14px 32px ${withAlpha(colors.surface, 0.45)}`,
          }}
        >
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.06) brightness(0.98)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: radius.md,
              boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.22)}`,
            }}
          />
        </section>
      ) : null}

      <section
        className="flex min-h-0 flex-1 items-center justify-center"
        style={{ padding: `${pad}px` }}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            gap: scaled(14, viewport, 5),
            maxWidth: 880,
            padding: viewport.isCompact
              ? `${scaled(18, viewport, 8)}px ${scaled(20, viewport, 10)}px`
              : `${scaled(40, viewport, 14)}px ${scaled(52, viewport, 18)}px`,
          }}
        >
          {/* Brass corner ornaments — only on wider zones where the
              paper margin is big enough for them to read as ornaments
              rather than clutter. */}
          {!stackVertical && !viewport.isCompact ? (
            <>
              <CornerOrnament placement="tl" viewport={viewport} accent={accent} />
              <CornerOrnament placement="tr" viewport={viewport} accent={accent} />
              <CornerOrnament placement="bl" viewport={viewport} accent={accent} />
              <CornerOrnament placement="br" viewport={viewport} accent={accent} />
            </>
          ) : null}

          <div className="flex shrink-0 flex-col" style={{ gap: scaled(12, viewport, 4), alignItems: stackVertical ? 'flex-start' : 'center' }}>
            <span
              style={kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 10),
              )}
            >
              Aus der Saunawelt · Info
            </span>
            <h2
              style={{
                color: colors.textPrimary,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * headingScale, viewport, 20)}px`,
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.02em',
                margin: 0,
                textAlign: stackVertical ? 'left' : 'center',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: viewport.isCompact ? 2 : 3,
              }}
            >
              {data.title}
            </h2>
            <div
              style={{
                ...brassHairline(colors, 1),
                width: scaled(120, viewport, 56),
                alignSelf: stackVertical ? 'flex-start' : 'center',
              }}
            />
          </div>

          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: colors.textPrimary,
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.6,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                margin: 0,
                textAlign: stackVertical ? 'left' : 'center',
                textWrap: 'pretty' as React.CSSProperties['textWrap'],
              }}
            >
              {data.text}
            </p>
          </AutoScroll>
        </div>
      </section>
    </div>
  );
}

function CornerOrnament({
  placement,
  viewport,
  accent,
}: {
  placement: 'tl' | 'tr' | 'bl' | 'br';
  viewport: Viewport;
  accent: string;
}) {
  const size = scaled(32, viewport, 16);
  const isTop = placement.startsWith('t');
  const isLeft = placement.endsWith('l');
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        width: size,
        height: size,
        [isTop ? 'top' : 'bottom']: 0,
        [isLeft ? 'left' : 'right']: 0,
        borderTop: isTop ? `1px solid ${withAlpha(accent, 0.75)}` : 'none',
        borderBottom: !isTop ? `1px solid ${withAlpha(accent, 0.75)}` : 'none',
        borderLeft: isLeft ? `1px solid ${withAlpha(accent, 0.75)}` : 'none',
        borderRight: !isLeft ? `1px solid ${withAlpha(accent, 0.75)}` : 'none',
        pointerEvents: 'none',
      }}
    />
  );
}
