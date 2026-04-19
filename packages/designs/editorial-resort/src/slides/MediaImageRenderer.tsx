import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { kickerStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Editorial Resort — media-image renderer.
 *
 * Full-bleed image with an optional caption strip (serif title on a
 * subtle cream gradient) for a magazine-print feel.
 */
export function MediaImageRenderer({ data, tokens, context }: SlideRendererProps<'media-image'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;

  if (!data.url) {
    return <EmptyFrame label="Kein Bild verfügbar" tokens={tokens} viewport={viewport} />;
  }

  const fitMode = data.fit === 'contain' ? 'contain' : 'cover';
  const shouldShowTitle = Boolean(data.showTitle && data.title);
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="relative h-full w-full"
      style={{ backgroundColor: fitMode === 'contain' ? colors.surface : 'transparent' }}
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
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{
              height: '40%',
              background: `linear-gradient(to top, ${withAlpha(colors.textPrimary, 0.82)} 0%, transparent 100%)`,
            }}
          />
          <div
            className="absolute flex flex-col"
            style={{
              left: pad,
              right: pad,
              bottom: pad,
              gap: scaled(8, viewport, 3),
            }}
          >
            <span
              style={{
                ...kickerStyles(
                  colors.textInverse,
                  scaledFont(typography.baseSizePx * typography.scaleSm, viewport, 10),
                ),
                textShadow: `0 1px 6px ${withAlpha(colors.textPrimary, 0.55)}`,
              }}
            >
              Aus der Saunawelt
            </span>
            <span
              style={{
                color: colors.textInverse,
                fontFamily: typography.fontHeading,
                fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl, viewport, 16)}px`,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                textShadow: `0 2px 10px ${withAlpha(colors.textPrimary, 0.55)}`,
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

function EmptyFrame({
  label,
  tokens,
  viewport,
}: {
  label: string;
  tokens: SlideRendererProps<'media-image'>['tokens'];
  viewport: SlideRendererProps<'media-image'>['context']['viewport'];
}) {
  const { colors, typography } = tokens;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        backgroundColor: colors.surface,
        color: withAlpha(colors.textSecondary, 0.85),
        fontFamily: typography.fontHeading,
        fontStyle: 'italic',
        fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
      }}
    >
      {label}
    </div>
  );
}
