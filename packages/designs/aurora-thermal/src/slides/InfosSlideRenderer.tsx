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
 *   - background image → full-bleed photo with a bottom masthead
 *                        block anchored over a vignette
 *   - side image       → 55/45 split, editorial column left, framed
 *                        photograph right
 *   - no image         → centred editorial column on the ambient
 *                        background; brass corner ornaments give it
 *                        weight without relying on a photo
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
          style={{ filter: 'saturate(1.05) brightness(0.78)' }}
        />
        {/* Vignette — warmer at the bottom, matches brass */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(colors.surface, 0.15)} 0%, ${withAlpha(colors.surface, 0.0)} 30%, ${withAlpha(colors.surface, 0.65)} 65%, ${withAlpha(colors.surface, 0.96)} 100%)`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 40% at 50% 100%, ${withAlpha(accent, 0.22)} 0%, transparent 70%)`,
          }}
        />

        <div
          className="relative z-10 flex flex-col"
          style={{
            padding: `${pad}px`,
            gap: scaled(18, viewport, 7),
            maxWidth: '78%',
          }}
        >
          <span
            style={{
              ...kickerStyles(
                accent,
                scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 10),
              ),
              textShadow: `0 1px 6px ${withAlpha(colors.surface, 0.65)}`,
            }}
          >
            Aus der Saunawelt
          </span>
          <h2
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.3, viewport, 26)}px`,
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: '-0.025em',
              margin: 0,
              textShadow: `0 2px 14px ${withAlpha(colors.surface, 0.72)}`,
            }}
          >
            {data.title}
          </h2>
          <div style={{ ...brassHairline(colors, 1), width: scaled(160, viewport, 70) }} />
          <p
            style={{
              color: withAlpha(colors.textPrimary, 0.95),
              fontFamily: typography.fontBody,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              maxWidth: 860,
              margin: 0,
              textShadow: `0 1px 6px ${withAlpha(colors.surface, 0.6)}`,
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
          style={{ padding: `${pad}px`, gap: scaled(20, viewport, 7) }}
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
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.15, viewport, 22)}px`,
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: '-0.025em',
              margin: 0,
            }}
          >
            {data.title}
          </h2>
          <div style={{ ...brassHairline(colors, 1), width: scaled(140, viewport, 60) }} />
          <p
            style={{
              color: withAlpha(colors.textPrimary, 0.92),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
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
              withAlpha(colors.textSecondary, 0.85),
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
            style={{ filter: 'saturate(1.06) brightness(0.95)' }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: radius.lg,
              boxShadow: `inset 0 0 0 1px ${withAlpha(accent, 0.22)}, inset 0 -80px 120px ${withAlpha(colors.surface, 0.25)}`,
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.3, viewport, 24)}px`,
            fontWeight: 400,
            lineHeight: 0.95,
            letterSpacing: '-0.025em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {data.title}
        </h2>
        <div style={{ ...brassHairline(colors, 1), width: scaled(120, viewport, 56), alignSelf: 'center' }} />
        <p
          style={{
            color: withAlpha(colors.textPrimary, 0.94),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
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
