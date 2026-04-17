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

interface SlideTransitionFrameProps {
  children: ReactNode;
  duration: number;
  transition: TransitionType;
}

function SlideTransitionFrame({
  children,
  duration,
  transition,
}: SlideTransitionFrameProps) {
  const [isVisible, setIsVisible] = useState(false);

  const variants = variantMap[transition] || fadeVariants;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const style = useMemo<CSSProperties>(() => {
    const from = variants.initial;
    const to = variants.animate;

    return {
      opacity: isVisible ? to.opacity : from.opacity,
      transform: isVisible
        ? `translateX(${to.x ?? 0}px) scale(${to.scale ?? 1})`
        : `translateX(${from.x ?? 0}px) scale(${from.scale ?? 1})`,
      transition: `opacity ${duration}s ease-in-out, transform ${duration}s ease-in-out`,
      willChange: 'opacity, transform',
    };
  }, [duration, isVisible, variants.animate, variants.initial]);

  return (
    <div className="w-full h-full" style={style}>
      {children}
    </div>
  );
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

  if (!shouldAnimate && !showProgress) {
    return <>{children}</>;
  }

  const inner = shouldAnimate ? (
    <SlideTransitionFrame key={slideKey} duration={duration} transition={transition}>
      {children}
    </SlideTransitionFrame>
  ) : (
    <>{children}</>
  );

  if (!showProgress) {
    return inner;
  }

  return (
    <div className="relative w-full h-full">
      {inner}
      <SlideProgressIndicator
        key={`progress:${slideKey}`}
        durationSec={progressDurationSec!}
        color={progressColor!}
      />
    </div>
  );
}
