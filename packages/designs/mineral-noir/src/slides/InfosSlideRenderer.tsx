import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — infos renderer.
 *
 * Editorial composition:
 *   - background image mode → full-bleed image with deep slate wash + bottom-aligned text column
 *   - side image mode       → 60/40 split, image right, text left
 *   - no image / 'none'     → centred prose on slate surface
 */
export function InfosSlideRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'infos'>) {
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
          color: colors.textPrimary,
          fontFamily: typography.fontBody,
        }}
      >
        <img
          src={data.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: 'saturate(0.8) brightness(0.65)' }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: withAlpha(colors.surface, 0.45) }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${withAlpha(colors.surface, 0.95)} 0%, ${withAlpha(colors.surface, 0.25)} 55%, transparent 100%)`,
          }}
        />
        <div
          className="relative z-10 flex flex-col"
          style={{
            padding: `${pad}px`,
            gap: scaled(18, viewport, 7),
            maxWidth: '70%',
          }}
        >
          <span style={labelStyles(accent, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
            {data.title ? 'Info' : 'Hinweis'}
          </span>
          <h2
            className="font-black"
            style={{
              color: colors.textPrimary,
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.25, viewport, 20)}px`,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
            }}
          >
            {data.title}
          </h2>
          <div
            style={{
              height: 1,
              backgroundColor: withAlpha(accent, 0.5),
              width: scaled(120, viewport, 60),
            }}
          />
          <p
            style={{
              color: withAlpha(colors.textPrimary, 0.88),
              fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              fontWeight: 400,
              maxWidth: 760,
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
        style={{ padding: `${pad}px`, gap: scaled(16, viewport, 6) }}
      >
        <span style={labelStyles(accent, scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10))}>
          Info
        </span>
        <h2
          className="font-black"
          style={{
            color: colors.textPrimary,
            fontFamily: typography.fontHeading,
            fontSize: `${scaledFont(typography.baseSizePx * typography.scale3xl * 1.1, viewport, 18)}px`,
            lineHeight: 1.0,
            letterSpacing: '-0.02em',
          }}
        >
          {data.title}
        </h2>
        <div
          style={{
            height: 1,
            backgroundColor: withAlpha(accent, 0.5),
            width: scaled(100, viewport, 50),
          }}
        />
        <p
          style={{
            color: withAlpha(colors.textPrimary, 0.88),
            fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 12)}px`,
            lineHeight: 1.55,
            whiteSpace: 'pre-line',
            fontWeight: 400,
            maxWidth: 720,
          }}
        >
          {data.text}
        </p>
      </section>
      {hasSideImage ? (
        <section className="relative overflow-hidden">
          <img
            src={data.imageUrl ?? undefined}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'saturate(0.85) brightness(0.78)' }}
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
