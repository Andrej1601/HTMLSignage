import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Wellness Classic — infos slide renderer.
 *
 * A deliberately small pilot: a light surface card with one headline,
 * one image (optional), and the body text. Typography and spacing
 * come from tokens; no business logic, no settings access.
 */
export function InfosSlideRenderer({ data, tokens }: SlideRendererProps<'infos'>) {
  const { colors, typography, spacing, radius } = tokens;

  const hasBackgroundImage = data.imageMode === 'background' && data.imageUrl;
  const hasSideImage = data.imageMode === 'side' && data.imageUrl;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        fontFamily: typography.fontBody,
        fontSize: `${typography.baseSizePx}px`,
        lineHeight: typography.baseLineHeight,
      }}
    >
      {hasBackgroundImage && (
        <>
          <img
            src={data.imageUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0.75) 100%)',
            }}
          />
        </>
      )}

      <div
        className="relative z-10 flex h-full items-center"
        style={{ padding: `${spacing.xl}px` }}
      >
        <div
          className="flex w-full items-center"
          style={{ gap: hasSideImage ? `${spacing.xl}px` : 0 }}
        >
          {hasSideImage && (
            <div
              className="shrink-0 overflow-hidden shadow-lg"
              style={{
                width: '35%',
                aspectRatio: '4 / 3',
                borderRadius: `${radius.lg}px`,
              }}
            >
              <img
                src={data.imageUrl!}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2
              className="font-black uppercase"
              style={{
                fontSize: `${typography.baseSizePx * typography.scale2xl}px`,
                letterSpacing: '0.2em',
                color: hasBackgroundImage ? colors.textInverse : colors.accentPrimary,
                marginBottom: `${spacing.md}px`,
              }}
            >
              {data.title}
            </h2>
            <p
              className="font-semibold italic"
              style={{
                fontSize: `${typography.baseSizePx * typography.scaleXl}px`,
                lineHeight: 1.5,
                color: hasBackgroundImage
                  ? 'rgba(255, 255, 255, 0.92)'
                  : colors.textSecondary,
                borderLeft: `4px solid ${
                  hasBackgroundImage
                    ? 'rgba(255, 255, 255, 0.7)'
                    : colors.accentSecondary
                }`,
                paddingLeft: `${spacing.md}px`,
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {data.text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
