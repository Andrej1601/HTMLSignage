import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { scaled, scaledFont } from './responsive';

/**
 * Wellness Classic — media-video slide renderer.
 *
 * Autoplays muted, inline, and loops when the slide config prefers
 * duration-bound playback. Invokes `context.onVideoEnded` once the
 * native element fires its `ended` event; the host advances to the
 * next slide when `playback === 'complete'`.
 */
export function MediaVideoRenderer({
  data,
  tokens,
  context,
}: SlideRendererProps<'media-video'>) {
  const { typography } = tokens;
  const { viewport } = context;
  const shouldLoop = data.playback === 'loop-duration' || data.playback === 'duration';
  const showTitle = data.showTitle && data.title && !viewport.isUltraCompact;

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
