import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { SlideProgressIndicator } from '@/components/Display/SlideProgressIndicator';

type TransitionType = 'fade' | 'slide' | 'zoom' | 'none';

interface AnimationState {
  opacity: number;
  scale?: number;
  x?: number;
}

interface AnimationVariants {
  initial: AnimationState;
  animate: AnimationState;
  exit: AnimationState;
}

interface SlideTransitionProps {
  children: ReactNode;
  slideKey: string | number;
  enabled?: boolean;
  duration?: number;
  transition?: TransitionType;
  /**
   * Slide duration in seconds. When provided (together with a non-empty
   * `progressColor`), a thin full-width progress line is rendered at the
   * bottom edge of the transition frame, visualising the time left until
   * the next slide. Pass `undefined`/`0` to disable.
   */
  progressDurationSec?: number;
  /** Accent color for the progress fill. Usually the theme's accentGold. */
  progressColor?: string;
}

const fadeVariants: AnimationVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideVariants: AnimationVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const zoomVariants: AnimationVariants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.08 },
};

const variantMap: Record<TransitionType, AnimationVariants> = {
  fade: fadeVariants,
  slide: slideVariants,
  zoom: zoomVariants,
  none: fadeVariants, // fallback, won't be used since enabled=false for 'none'
};

function frameStyle(state: AnimationState, duration: number): CSSProperties {
  return {
    opacity: state.opacity,
    transform: `translateX(${state.x ?? 0}px) scale(${state.scale ?? 1})`,
    transition: `opacity ${duration}s ease-in-out, transform ${duration}s ease-in-out`,
    willChange: 'opacity, transform',
  };
}

/** Incoming slide: starts at `initial`, animates to `animate` on mount. */
function IncomingFrame({
  children,
  duration,
  transition,
}: {
  children: ReactNode;
  duration: number;
  transition: TransitionType;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const variants = variantMap[transition] || fadeVariants;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const style = useMemo<CSSProperties>(
    () => frameStyle(isVisible ? variants.animate : variants.initial, duration),
    [duration, isVisible, variants.animate, variants.initial],
  );

  return (
    <div className="w-full h-full" style={style}>
      {children}
    </div>
  );
}

/** Outgoing slide: starts at `animate` (fully visible), animates to `exit`. */
function OutgoingFrame({
  children,
  duration,
  transition,
}: {
  children: ReactNode;
  duration: number;
  transition: TransitionType;
}) {
  const [leaving, setLeaving] = useState(false);
  const variants = variantMap[transition] || fadeVariants;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLeaving(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const style = useMemo<CSSProperties>(
    () => frameStyle(leaving ? variants.exit : variants.animate, duration),
    [duration, leaving, variants.animate, variants.exit],
  );

  return (
    <div className="absolute inset-0 w-full h-full" style={style}>
      {children}
    </div>
  );
}

interface OutgoingLayer {
  node: ReactNode;
  transition: TransitionType;
}

export function SlideTransition({
  children,
  slideKey,
  enabled = true,
  duration = 0.6,
  transition = 'fade',
  progressDurationSec,
  progressColor,
}: SlideTransitionProps) {
  const shouldAnimate = enabled && transition !== 'none';
  const showProgress =
    typeof progressDurationSec === 'number'
    && progressDurationSec > 0
    && !!progressColor;

  // Double-buffer crossfade: when the slide changes, the previously shown slide
  // is kept mounted as an `outgoing` layer and fades out while the new slide
  // fades in over it — no flash of empty zone background between slides.
  // `current.node` snapshots the slide at change time; the live `children` is
  // rendered on the incoming layer so the active slide still updates.
  const [current, setCurrent] = useState<OutgoingLayer & { key: string | number }>(
    () => ({ key: slideKey, node: children, transition }),
  );
  const [outgoing, setOutgoing] = useState<OutgoingLayer | null>(null);

  if (current.key !== slideKey) {
    setOutgoing(shouldAnimate ? { node: current.node, transition: current.transition } : null);
    setCurrent({ key: slideKey, node: children, transition });
  }
  const renderedKey = current.key;

  // Drop the outgoing layer once the crossfade has completed.
  useEffect(() => {
    if (!outgoing) return;
    const timer = window.setTimeout(() => setOutgoing(null), duration * 1000 + 80);
    return () => window.clearTimeout(timer);
  }, [outgoing, duration]);

  if (!shouldAnimate && !showProgress) {
    return <>{children}</>;
  }

  const incoming = shouldAnimate ? (
    <IncomingFrame key={renderedKey} duration={duration} transition={transition}>
      {children}
    </IncomingFrame>
  ) : (
    <>{children}</>
  );

  // The incoming layer is ALWAYS rendered at the same tree position (direct
  // child of the stage) so it is never re-mounted when the outgoing layer is
  // dropped — otherwise the new slide would replay its enter animation ~600ms
  // after the switch (a visible second flash). The outgoing layer simply
  // overlays it absolutely while it fades out.
  const stage = (
    <div className="relative w-full h-full">
      {outgoing && (
        <OutgoingFrame duration={duration} transition={outgoing.transition}>
          {outgoing.node}
        </OutgoingFrame>
      )}
      {incoming}
    </div>
  );

  if (!showProgress) {
    return stage;
  }

  return (
    <div className="relative w-full h-full">
      {stage}
      <SlideProgressIndicator
        key={`progress:${renderedKey}`}
        durationSec={progressDurationSec!}
        color={progressColor!}
      />
    </div>
  );
}
