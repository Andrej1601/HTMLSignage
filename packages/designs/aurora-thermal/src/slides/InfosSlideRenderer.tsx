import type { SlideRendererProps } from '@htmlsignage/design-sdk';
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
 * Three layout modes — each inherits the same typographic voice:
 *
 *   - background image → full-bleed photo; text lives in a brass-
 *                        bordered glass card at the bottom-left so
 *                        contrast survives any image luminance
 *   - side image       → 55/45 split, editorial column left, framed
 *                        photograph right
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
  const pad = scaled(spacing.xl, viewport, 14);
  const accent = data.accentColor ?? colors.accentPrimary;

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
            contrast regardless of image luminance. */}
        <div
          className="relative z-10 flex flex-col"
          style={{
            margin: `${pad}px`,
            padding: `${scaled(24, viewport, 10)}px ${scaled(32, viewport, 12)}px`,
            borderRadius: radius.lg,
            border: `1px solid ${withAlpha(accent, 0.5)}`,
            backgroundColor: withAlpha(colors.surface, 0.78),
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: `0 22px 52px ${withAlpha(colors.surface, 0.55)}`,
            gap: scaled(16, viewport, 6),
            maxWidth: '80%',
          }}
        >
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
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.2, viewport, 24)}px`,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            {data.title}
          </h2>
          <div style={{ ...brassHairline(colors, 1), width: scaled(140, viewport, 60) }} />
          <p
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontBody,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg * 1.08, viewport, 13)}px`,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              maxWidth: 820,
              margin: 0,
            }}
          >
            {data.text}
          </p>
        </div>
      </div>
    );
  }

  // ── Mode: side image ────────────────────────────────────────────────────
  const hasSideImage = Boolean(data.imageUrl) && data.imageMode === 'side';

  if (hasSideImage) {
    return (
      <div
        className="grid h-full w-full overflow-hidden"
        style={{
          background: auroraAmbientBackground(colors),
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
          gridTemplateColumns: viewport.isNarrow ? '1fr' : '55fr 45fr',
        }}
      >
        <section
          className="flex flex-col justify-center min-w-0"
          style={{ padding: `${pad}px`, gap: scaled(18, viewport, 7) }}
        >
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
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.1, viewport, 22)}px`,
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            {data.title}
          </h2>
          <div style={{ ...brassHairline(colors, 1), width: scaled(140, viewport, 60) }} />
          <p
            style={{
              // Full-alpha textPrimary; the 0.92 multiplier was too
              // dim on warm charcoal and dropped below comfortable
              // legibility for operators reading from across the spa.
              color: colors.textPrimary,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg * 1.08, viewport, 13)}px`,
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

  // ── Mode: no image (centred editorial column) ──────────────────────────
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden"
      style={{
        background: auroraAmbientBackground(colors),
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        padding: `${pad}px`,
      }}
    >
      <div
        className="relative flex flex-col"
        style={{
          gap: scaled(22, viewport, 9),
          maxWidth: 880,
          padding: `${scaled(56, viewport, 20)}px ${scaled(72, viewport, 26)}px`,
        }}
      >
        {/* Brass corner ornaments — a quiet nod to bookbinding. */}
        <CornerOrnament placement="tl" viewport={viewport} accent={accent} />
        <CornerOrnament placement="tr" viewport={viewport} accent={accent} />
        <CornerOrnament placement="bl" viewport={viewport} accent={accent} />
        <CornerOrnament placement="br" viewport={viewport} accent={accent} />

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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.2, viewport, 24)}px`,
            fontWeight: 500,
            lineHeight: 0.98,
            letterSpacing: '-0.02em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {data.title}
        </h2>
        <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 56), alignSelf: 'center' }} />
        <p
          style={{
            color: colors.textPrimary,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg * 1.08, viewport, 13)}px`,
            lineHeight: 1.65,
            whiteSpace: 'pre-line',
            fontWeight: 400,
            margin: 0,
            textAlign: 'center',
            textWrap: 'pretty' as React.CSSProperties['textWrap'],
          }}
        >
          {data.text}
        </p>
      </div>
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
