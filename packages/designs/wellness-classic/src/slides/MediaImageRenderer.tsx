import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { scaled, scaledFont } from './responsive';

/**
 * Wellness Classic — media-image slide renderer.
 *
 * Fullscreen image with `cover`/`contain` fit and an optional title
 * overlay anchored to the bottom edge. Title suppresses itself on
 * ultra-compact viewports.
 */
export function MediaImageRenderer({ data, tokens, context }: SlideRendererProps<'media-image'>) {
  const { typography } = tokens;
  const { viewport } = context;
  const showTitle = data.showTitle && data.title && !viewport.isUltraCompact;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <img
        src={data.url}
        alt={data.altText ?? ''}
        className={`h-full w-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
      />
      {showTitle ? (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            padding: `${scaled(32, viewport, 10)}px`,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0) 100%)',
          }}
        >
          <h2
            className="font-bold"
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fontHeading,
              fontSize: `${scaledFont(
                typography.baseSizePx * typography.scale3xl * 1.2,
                viewport,
                16,
              )}px`,
              lineHeight: 1.1,
            }}
          >
            {data.title}
          </h2>
        </div>
      ) : null}
    </div>
  );
}
