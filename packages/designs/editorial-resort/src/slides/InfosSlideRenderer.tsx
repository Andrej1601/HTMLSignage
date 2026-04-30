import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import {
  eyebrowStyles,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/** Photo-overlay text — see SaunaDetailRenderer for rationale. */
const PHOTO_TEXT_LIGHT = '#FAF4E8';

/**
 * Editorial Resort — infos renderer.
 *
 * Treats each info like a short editorial article:
 *   - background image mode → full-bleed photo with bottom article block
 *   - side image mode       → 60/40 split, text left, photograph right
 *   - no image              → centred editorial column
 */
export function InfosSlideRenderer({ data, tokens, context }: SlideRendererProps<'infos'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const pad = scaled(spacing.xl, viewport, 10);
  const accent = data.accentColor ?? colors.accentPrimary;

  if (data.imageMode === 'background' && data.imageUrl) {
    return (
      <div
        className="relative flex h-full w-full flex-col justify-end overflow-hidden"
        style={{
          backgroundColor: colors.surface,
          color: PHOTO_TEXT_LIGHT,
          fontFamily: typography.fontBody,
        }}
      >
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(0.95) brightness(0.82)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${withAlpha(colors.textPrimary, 0.9)} 0%, ${withAlpha(colors.textPrimary, 0.3)} 55%, transparent 100%)`,
          }}
        />
        <div
          className="relative z-10 flex flex-col"
          style={{
            padding: `${pad}px`,
            gap: scaled(18, viewport, 7),
            maxWidth: '72%',
          }}
        >
          <span
            style={{
              ...kickerStyles(
                PHOTO_TEXT_LIGHT,
                scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
              ),
              textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.6)}`,
            }}
          >
            Info
          </span>
          <h2
            style={{
              color: PHOTO_TEXT_LIGHT,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.25, viewport, 22)}px`,
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              margin: 0,
              textShadow: `0 2px 12px ${withAlpha(colors.textPrimary, 0.6)}`,
            }}
          >
            {data.title}
          </h2>
          <div
            style={{
              height: 1,
              backgroundColor: withAlpha(accent, 0.75),
              width: scaled(120, viewport, 60),
            }}
          />
          <p
            style={{
              color: withAlpha(PHOTO_TEXT_LIGHT, 0.94),
              fontFamily: typography.fontBody,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              maxWidth: 820,
              margin: 0,
              textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.55)}`,
            }}
          >
            {data.text}
          </p>
        </div>
      </div>
    );
  }

  const hasSideImage = data.imageUrl && data.imageMode === 'side';

  return (
    <div
      className="grid h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        gridTemplateColumns: hasSideImage ? '6fr 4fr' : '1fr',
      }}
    >
      <section
        className="flex flex-col justify-center"
        style={{ padding: `${pad}px`, gap: scaled(18, viewport, 7) }}
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
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.1, viewport, 20)}px`,
            fontWeight: 600,
            lineHeight: 1.0,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {data.title}
        </h2>
        <div
          style={{
            height: 1,
            backgroundColor: withAlpha(accent, 0.7),
            width: scaled(108, viewport, 50),
          }}
        />
        <p
          style={{
            color: withAlpha(colors.textPrimary, 0.92),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
            fontWeight: 400,
            maxWidth: 640,
            margin: 0,
            /* Balanced wrapping for editorial feel (supported browsers). */
            textWrap: 'pretty' as React.CSSProperties['textWrap'],
          }}
        >
          {data.text}
        </p>
        {/* Byline-ish closer */}
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
      {hasSideImage ? (
        <section className="relative overflow-hidden">
          <img
            src={data.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(1.02) brightness(1.0)' }}
          />
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: 1,
              backgroundColor: withAlpha(colors.textPrimary, 0.15),
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
