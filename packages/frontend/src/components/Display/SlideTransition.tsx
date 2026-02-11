import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

interface SlideTransitionProps {
  children: ReactNode;
  slideKey: string | number;
  enabled?: boolean;
  duration?: number;
}

const fadeVariants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

export function SlideTransition({
  children,
  slideKey,
  enabled = true,
  duration = 0.6,
}: SlideTransitionProps) {
  // Debug logging (dev only)
  if ((import.meta as any).env?.DEV) {
    console.log('[SlideTransition] Key:', slideKey, 'Enabled:', enabled);
  }

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideKey}
        variants={fadeVariants}
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
