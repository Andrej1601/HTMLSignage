import { useEffect, useRef, type ReactNode } from 'react';

interface AutoScrollProps {
  /** Content that should auto-scroll when taller than the container. */
  children: ReactNode;
  /** Speed in pixels per second. Legacy uses 14; keep in range 8–24. */
  speedPxPerSec?: number;
  /** Delay before the first scroll starts, in ms. */
  startDelayMs?: number;
  /** Pause at the top and bottom of each cycle, in ms. */
  pauseMs?: number;
  className?: string;
}

/**
 * Vertical auto-scroll container — scrolls its children up and down in a
 * loop when they overflow, otherwise stays static. No visible scrollbar,
 * no framer-motion dependency; just requestAnimationFrame + CSS
 * transforms.
 *
 * The inner element is observed with `ResizeObserver`, so content or
 * container size changes restart the cycle with the new bounds.
 */
export function AutoScroll({
  children,
  speedPxPerSec = 14,
  startDelayMs = 4000,
  pauseMs = 1200,
  className,
}: AutoScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    let raf = 0;
    let cycleStart = 0;
    let cachedMax = 0;
    let cachedCycleMs = 0;

    const recalc = () => {
      const max = Math.max(0, content.scrollHeight - container.clientHeight);
      if (max === cachedMax) return;
      cachedMax = max;
      if (max === 0) {
        cachedCycleMs = 0;
        content.style.transform = 'translateY(0)';
        return;
      }
      const scrollMs = (max / Math.max(4, speedPxPerSec)) * 1000;
      cachedCycleMs = scrollMs * 2 + pauseMs * 2;
      cycleStart = performance.now() + startDelayMs;
    };

    const tick = () => {
      const now = performance.now();
      if (cachedCycleMs === 0) {
        content.style.transform = 'translateY(0)';
        raf = requestAnimationFrame(tick);
        return;
      }

      if (now < cycleStart) {
        content.style.transform = 'translateY(0)';
        raf = requestAnimationFrame(tick);
        return;
      }

      const elapsed = (now - cycleStart) % cachedCycleMs;
      const halfCycle = cachedCycleMs / 2;
      const scrollMs = halfCycle - pauseMs;

      let offset = 0;
      if (elapsed < scrollMs) {
        // Scrolling down
        offset = (elapsed / scrollMs) * cachedMax;
      } else if (elapsed < halfCycle) {
        // Paused at bottom
        offset = cachedMax;
      } else if (elapsed < halfCycle + scrollMs) {
        // Scrolling up
        offset = cachedMax - ((elapsed - halfCycle) / scrollMs) * cachedMax;
      } else {
        // Paused at top
        offset = 0;
      }

      content.style.transform = `translateY(${-offset}px)`;
      raf = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(() => {
      recalc();
    });
    observer.observe(container);
    observer.observe(content);

    recalc();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [speedPxPerSec, startDelayMs, pauseMs]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        ref={contentRef}
        style={{
          willChange: 'transform',
          transform: 'translateY(0)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
