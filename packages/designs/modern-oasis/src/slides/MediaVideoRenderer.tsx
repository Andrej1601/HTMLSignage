import type { SlideRendererProps } from '@htmlsignage/design-sdk';

/**
 * Modern Oasis — media-video slide renderer.
 *
 * TODO: Autoplay muted. Loop when `data.playback` is 'duration' or
 * 'loop-duration'. Invoke `context.onVideoEnded` once the native
 * element fires its 'ended' event — the host advances the slideshow.
 */
export function MediaVideoRenderer({
  data,
  context,
}: SlideRendererProps<'media-video'>) {
  const shouldLoop = data.playback === 'loop-duration' || data.playback === 'duration';
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video
        src={data.url}
        className={`h-full w-full ${data.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
        autoPlay
        muted={data.mutedByDefault}
        playsInline
        loop={shouldLoop}
        onEnded={context.onVideoEnded}
      />
    </div>
  );
}
