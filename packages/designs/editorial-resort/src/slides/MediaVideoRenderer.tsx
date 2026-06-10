import { useEffect, useRef } from 'react';
import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { kickerStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Editorial Resort — media-video renderer.
 *
 * Autoplaying muted-by-default video with an optional caption strip
 * matching the image renderer. Loops for `duration` / `loop-duration`
 * modes; for `complete` it plays once and calls `onVideoEnded` so the
 * host advances.
 */
export function MediaVideoRenderer({ data, tokens, context }: SlideRendererProps<'media-video'>) {
  const { colors, typography, spacing } = tokens;
  const { viewport } = context;
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      /* playback might not be ready yet */
    }
    void el.play().catch(() => {
      /* autoplay blocked; no-op */
    });
  }, [data.url]);

  if (!data.url) {
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
        Kein Video verfügbar
      </div>
    );
  }

  const fitMode = data.fit === 'contain' ? 'contain' : 'cover';
  const shouldLoop = data.playback === 'duration' || data.playback === 'loop-duration';
  const shouldShowTitle = Boolean(data.showTitle && data.title);
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="relative h-full w-full"
      style={{ backgroundColor: fitMode === 'contain' ? colors.surface : 'transparent' }}
    >
      <video
        ref={ref}
        src={data.url}
        muted={data.mutedByDefault}
        playsInline
        autoPlay
        loop={shouldLoop}
        preload="auto"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: fitMode }}
        onEnded={() => context.onVideoEnded?.()}
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
