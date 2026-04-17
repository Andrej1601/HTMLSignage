import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Wellness Classic — media-image slide renderer.
 *
 * Fullscreen image with `cover`/`contain` fit and an optional title
 * overlay anchored to the bottom edge. Tokens drive the overlay
 * gradient opacity and typography; the renderer itself is dumb.
 */
export function MediaImageRenderer({ data, tokens }: SlideRendererProps<'media-image'>) {
  const { typography } = tokens;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <img
        src={data.url}
        alt={data.altText ?? ''}
        className={`h-full w-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
      />
      {data.showTitle && data.title ? (
        <div
          className="absolute bottom-0 left-0 right-0 p-8"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0) 100%)',
          }}
        >
          <h2
            className="font-bold"
            style={{
              color: '#FFFFFF',
              fontFamily: typography.fontHeading,
              fontSize: `${typography.baseSizePx * typography.scale3xl * 1.2}px`,
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
