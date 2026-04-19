import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Gentle vertical auto-scroll for overflowing lists.
 *
 * Cycles: wait (startDelay) → scroll-down → pause → scroll-up → pause →
 * repeat. Uses rAF so the timing keeps up with the display's actual
 * refresh rate. Degrades gracefully when content fits the container
 * (no transform applied).
 *
 * Speed is intentionally slow — a sauna display should feel like it's
 * breathing, not auctioneering.
 */
interface AutoScrollProps {
  children: ReactNode;
  speedPxPerSec?: number;
  startDelayMs?: number;
  pauseMs?: number;
  className?: string;
}

export function AutoScroll({
  children,
  speedPxPerSec = 10,
  startDelayMs = 4500,
  pauseMs = 1800,
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
      if (cachedCycleMs === 0 || now < cycleStart) {
        content.style.transform = 'translateY(0)';
        raf = requestAnimationFrame(tick);
        return;
      }
      const elapsed = (now - cycleStart) % cachedCycleMs;
      const halfCycle = cachedCycleMs / 2;
      const scrollMs = halfCycle - pauseMs;

      let offset = 0;
      if (elapsed < scrollMs) offset = (elapsed / scrollMs) * cachedMax;
      else if (elapsed < halfCycle) offset = cachedMax;
      else if (elapsed < halfCycle + scrollMs) {
        offset = cachedMax - ((elapsed - halfCycle) / scrollMs) * cachedMax;
      } else offset = 0;

      content.style.transform = `translateY(${-offset}px)`;
      raf = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(() => recalc());
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
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div
        ref={contentRef}
        style={{ willChange: 'transform', transform: 'translateY(0)' }}
      >
        {children}
      </div>
    </div>
  );
}
