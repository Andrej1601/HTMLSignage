import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { AutoScroll } from './AutoScroll';
import { scaled, scaledFont } from './responsive';

/**
 * Wellness List — infos slide renderer.
 *
 * Structure is constant regardless of container size: title + body,
 * with an optional side image or full-bleed background image. Long
 * bodies auto-scroll instead of showing a scrollbar; everything else
 * simply scales with the viewport.
 */
export function InfosSlideRenderer({ data, tokens, context }: SlideRendererProps<'infos'>) {
  const { colors, typography } = tokens;
  const { viewport } = context;

  const hasBackgroundImage = data.imageMode === 'background' && !!data.imageUrl;
  const hasSideImage = data.imageMode === 'side' && !!data.imageUrl;

  const pad = scaled(32, viewport, 8);
  const gap = scaled(40, viewport, 12);
  const titleSize = scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 14);
  const bodySize = scaledFont(typography.baseSizePx * typography.scaleXl, viewport, 11);

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
        className="relative z-10 flex h-full flex-col"
        style={{ padding: `${pad}px` }}
      >
        <div
          className="flex min-h-0 flex-1 items-center"
          style={{ gap: hasSideImage ? `${gap}px` : 0 }}
        >
          {hasSideImage && (
            <div
              className="shrink-0 overflow-hidden shadow-lg"
              style={{
                width: '35%',
                aspectRatio: '4 / 3',
                borderRadius: `${scaled(24, viewport, 8)}px`,
              }}
            >
              <img
                src={data.imageUrl!}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex min-w-0 min-h-0 flex-1 flex-col">
            <h2
              className="font-black uppercase shrink-0"
              style={{
                fontSize: `${titleSize}px`,
                letterSpacing: '0.2em',
                color: hasBackgroundImage ? colors.textInverse : colors.accentPrimary,
                marginBottom: `${scaled(16, viewport, 4)}px`,
              }}
            >
              {data.title}
            </h2>
            <AutoScroll className="min-h-0 flex-1">
              <p
                className="font-semibold italic"
                style={{
                  fontSize: `${bodySize}px`,
                  lineHeight: 1.5,
                  color: hasBackgroundImage
                    ? 'rgba(255, 255, 255, 0.92)'
                    : colors.textSecondary,
                  borderLeft: `4px solid ${
                    hasBackgroundImage
                      ? 'rgba(255, 255, 255, 0.7)'
                      : colors.accentSecondary
                  }`,
                  paddingLeft: `${scaled(16, viewport, 6)}px`,
                  margin: 0,
                }}
              >
                {data.text}
              </p>
            </AutoScroll>
          </div>
        </div>
      </div>
    </div>
  );
}
