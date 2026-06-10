import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import {
  auroraAmbientBackground,
  brassHairline,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Aurora Thermal — infos renderer.
 *
 * Three layout modes, modelled on Mineral Noir's cleaner editorial
 * composition: text flows directly on the ambient surface (or on the
 * image for background-mode), no floating glass card. Body copy is
 * wrapped in `AutoScroll` so long copy pans gently inside whatever
 * room the zone actually provides.
 *
 *   - background image → full-bleed photo with warm wash + bottom
 *                        gradient; text at the bottom-left
 *   - side image       → 60/40 split (text 6fr, image 4fr); stacks
 *                        vertically on narrow zones
 *   - no image         → centred prose on the ambient backdrop
 */
export function InfosSlideRenderer({ data, tokens, context }: SlideRendererProps<'infos'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const accent = data.accentColor ?? colors.accentPrimary;

  // Padding adapts: a 40px outer margin on a 400×300 zone eats half
  // the canvas. We scale down aggressively on compact zones.
  const pad = viewport.isUltraCompact
    ? scaled(14, viewport, 6)
    : viewport.isCompact
      ? scaled(20, viewport, 8)
      : scaled(spacing.lg, viewport, 12);

  const headingScale = viewport.isUltraCompact
    ? typography.scale2xl
    : viewport.isCompact
      ? typography.scale3xl * 0.95
      : typography.scale3xl * 1.2;
  const bodyScale = viewport.isUltraCompact
    ? typography.scaleBase
    : viewport.isCompact
      ? typography.scaleLg
      : typography.scaleLg * 1.05;

  // ── Mode: background ────────────────────────────────────────────────────
  if (data.imageMode === 'background' && data.imageUrl) {
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
          style={{ filter: 'saturate(1.02) brightness(0.7)' }}
        />
        {/* Warm wash — cools the whole image so text reads. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: withAlpha(colors.surface, 0.4) }}
        />
        {/* Bottom gradient — stronger at the text column's anchor so
            the prose always sits on a near-solid base. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${withAlpha(colors.surface, 0.95)} 0%, ${withAlpha(colors.surface, 0.3)} 55%, transparent 100%)`,
          }}
        />
        {/* Warm accent glow at the bottom */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${withAlpha(accent, 0.18)} 0%, transparent 70%)`,
          }}
        />

        <div
          className="relative z-10 flex min-h-0 flex-col"
          style={{
            padding: `${pad}px`,
            gap: scaled(14, viewport, 5),
            maxWidth: viewport.isCompact ? '92%' : '72%',
            maxHeight: '72%',
          }}
        >
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
            )}
          >
            {data.title ? 'Info' : 'Hinweis'}
          </span>
          <h2
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * headingScale, viewport, 20)}px`,
              fontWeight: 500,
              lineHeight: 1.0,
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
          <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 56) }} />
          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: withAlpha(colors.textPrimary, 0.92),
                fontFamily: typography.fontBody,
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                maxWidth: 760,
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
          gridTemplateColumns: '6fr 4fr',
        }}
      >
        <section
          className="flex min-h-0 flex-col justify-center"
          style={{ padding: `${pad}px`, gap: scaled(14, viewport, 5) }}
        >
          <span
            style={kickerStyles(
              accent,
              scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
            )}
          >
            Info
          </span>
          <h2
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.1, viewport, 18)}px`,
              fontWeight: 500,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            {data.title}
          </h2>
          <div style={{ ...brassHairline(colors, 1), width: scaled(100, viewport, 50) }} />
          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: withAlpha(colors.textPrimary, 0.92),
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                maxWidth: 720,
                margin: 0,
              }}
            >
              {data.text}
            </p>
          </AutoScroll>
        </section>
        <section className="relative overflow-hidden">
          <img
            src={data.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.05) brightness(0.92)' }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 pointer-events-none"
            style={{
              width: 1,
              backgroundColor: withAlpha(accent, 0.35),
            }}
          />
        </section>
      </div>
    );
  }

  // ── Mode: side-image stacked OR no-image ───────────────────────────────
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
          style={{ height: viewport.isUltraCompact ? '28%' : '36%' }}
        >
          <img
            src={data.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.05) brightness(0.95)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `inset 0 -1px 0 0 ${withAlpha(accent, 0.3)}`,
            }}
          />
        </section>
      ) : null}

      <section
        className="flex min-h-0 flex-1 items-center justify-center"
        style={{ padding: `${pad}px` }}
      >
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{
            gap: scaled(14, viewport, 5),
            maxWidth: 880,
          }}
        >
          <span
            style={{
              ...kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
              ),
              alignSelf: stackVertical ? 'flex-start' : 'center',
            }}
          >
            Info
          </span>
          <h2
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * headingScale, viewport, 20)}px`,
              fontWeight: 500,
              lineHeight: 1.0,
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
          <AutoScroll className="min-h-0 flex-1">
            <p
              style={{
                color: withAlpha(colors.textPrimary, 0.92),
                fontSize: `${scaledFont(typography.baseSizePx * bodyScale, viewport, 11)}px`,
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                fontWeight: 400,
                margin: 0,
                textAlign: stackVertical ? 'left' : 'center',
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
