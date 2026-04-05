import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

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
}: SlideTransitionProps) {
  if (!enabled || transition === 'none') {
    return <>{children}</>;
  }

  return (
    <SlideTransitionFrame key={slideKey} duration={duration} transition={transition}>
      {children}
    </SlideTransitionFrame>
  );
}
