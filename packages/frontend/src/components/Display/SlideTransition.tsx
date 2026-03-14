import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

type TransitionType = 'fade' | 'slide' | 'zoom' | 'none';

interface SlideTransitionProps {
  children: ReactNode;
  slideKey: string | number;
  enabled?: boolean;
  duration?: number;
  transition?: TransitionType;
}

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideVariants = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -60 },
};

const zoomVariants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.08 },
};

const variantMap: Record<TransitionType, typeof fadeVariants> = {
  fade: fadeVariants,
  slide: slideVariants,
  zoom: zoomVariants,
  none: fadeVariants, // fallback, won't be used since enabled=false for 'none'
};

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

  const variants = variantMap[transition] || fadeVariants;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration,
          ease: 'easeInOut',
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
