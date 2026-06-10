import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — media-image renderer.
 *
 * Full-bleed image. If a slide title is configured and `showTitle` is
 * true, a small slate gradient anchors a platinum small-caps label
 * over the lower-left corner; otherwise the image is unadorned.
 */
export function MediaImageRenderer({ data, tokens, context }: SlideRendererProps<'media-image'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;

  if (!data.url) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{
          backgroundColor: colors.surface,
          color: withAlpha(colors.textSecondary, 0.8),
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Kein Bild verfügbar
      </div>
    );
  }

  const fitMode = data.fit === 'contain' ? 'contain' : 'cover';
  const shouldShowTitle = Boolean(data.showTitle && data.title);
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="relative h-full w-full"
      style={{
        backgroundColor: fitMode === 'contain' ? colors.surface : 'transparent',
      }}
    >
      <img
        src={data.url}
        alt={data.altText ?? ''}
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: fitMode }}
      />
      {shouldShowTitle ? (
        <>
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: '35%',
              background: `linear-gradient(to top, ${withAlpha(colors.surface, 0.85)} 0%, transparent 100%)`,
              pointerEvents: 'none',
            }}
          />
          <div
            className="absolute"
            style={{
              left: pad,
              right: pad,
              bottom: pad,
            }}
          >
            <span
              style={{
                ...labelStyles(
                  colors.accentPrimary,
                  scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
                ),
                textShadow: `0 1px 6px ${withAlpha(colors.surface, 0.85)}`,
              }}
            >
              {data.title}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
