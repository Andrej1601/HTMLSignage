import { useEffect, useRef } from 'react';
import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import { labelStyles, scaled, scaledFont, withAlpha } from './utils';

/**
 * Mineral Noir — media-video renderer.
 *
 * Autoplaying muted-by-default video. Loops for `duration` and
 * `loop-duration` modes; plays once and emits `onVideoEnded` for
 * `complete` so the host can advance.
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
          color: withAlpha(colors.textSecondary, 0.8),
          fontFamily: typography.fontBody,
          fontSize: `${scaledFont(typography.baseSizePx * typography.scaleLg, viewport, 11)}px`,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        Kein Video verfügbar
      </div>
    );
  }

  const fitMode = data.fit === 'contain' ? 'contain' : 'cover';
  const shouldLoop =
    data.playback === 'duration' || data.playback === 'loop-duration';
  const shouldShowTitle = Boolean(data.showTitle && data.title);
  const pad = scaled(spacing.xl, viewport, 10);

  return (
    <div
      className="relative h-full w-full"
      style={{
        backgroundColor: fitMode === 'contain' ? colors.surface : 'transparent',
      }}
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
