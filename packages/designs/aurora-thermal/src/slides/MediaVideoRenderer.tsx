import { useEffect, useRef } from 'react';
import type { SlideRendererProps } from '@htmlsignage/design-sdk';
import {
  brassHairline,
  kickerStyles,
  scaled,
  scaledFont,
  withAlpha,
} from './utils';

/**
 * Aurora Thermal — media-video renderer.
 *
 * Autoplaying, muted-by-default. Mirrors `MediaImageRenderer`'s caption
 * card so static and moving image slides feel like pages of the same
 * brochure rather than two unrelated widgets.
 */
export function MediaVideoRenderer({ data, tokens, context }: SlideRendererProps<'media-video'>) {
  const { colors, typography, spacing, radius } = tokens;
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
  const pad = scaled(spacing.xl, viewport, 14);

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
              height: '55%',
              background: `linear-gradient(to top, ${withAlpha(colors.surface, 0.88)} 0%, ${withAlpha(colors.surface, 0.1)} 80%, transparent 100%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 70% 50% at 0% 100%, ${withAlpha(colors.accentPrimary, 0.18)} 0%, transparent 70%)`,
            }}
          />

          <div
            className="absolute flex"
            style={{
              left: pad,
              right: pad,
              bottom: pad,
            }}
          >
            <div
              className="flex flex-col"
              style={{
                gap: scaled(10, viewport, 3),
                padding: `${scaled(18, viewport, 7)}px ${scaled(24, viewport, 9)}px`,
                borderRadius: radius.lg,
                border: `1px solid ${withAlpha(colors.accentPrimary, 0.4)}`,
                backgroundColor: withAlpha(colors.surface, 0.55),
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: `0 18px 44px ${withAlpha(colors.surface, 0.5)}`,
                maxWidth: '72%',
              }}
            >
              <span
                style={kickerStyles(
                  colors.accentPrimary,
                  scaledFont(typography.baseSizePx * typography.scaleSm * 0.95, viewport, 10),
                )}
              >
                Aus der Saunawelt
              </span>
              <div style={{ ...brassHairline(colors, 1), width: scaled(48, viewport, 22) }} />
              <span
                style={{
                  color: colors.textPrimary,
                  fontFamily: typography.fontHeading,
                  fontSize: `${scaledFont(typography.baseSizePx * typography.scale2xl * 1.15, viewport, 18)}px`,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                }}
              >
                {data.title}
              </span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
