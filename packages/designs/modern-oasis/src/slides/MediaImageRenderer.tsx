import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Modern Oasis — media-image slide renderer.
 *
 * TODO: Render a fullscreen image from {@link data.url}. Honour the
 * `data.fit` ("cover" | "contain") and render an optional overlay
 * title when `data.showTitle && data.title`.
 */
export function MediaImageRenderer({ data }: SlideRendererProps<'media-image'>) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <img
        src={data.url}
        alt={data.altText ?? ''}
        className={`h-full w-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
      />
    </div>
  );
}
