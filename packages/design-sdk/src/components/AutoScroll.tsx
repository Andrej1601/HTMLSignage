import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Gentle auto-scroll for overflowing content — vertical by default,
 * horizontal when `axis="x"`.
 *
 * Cycles: wait (`startDelayMs`) → scroll to far edge → pause (`pauseMs`)
 * → scroll back → pause → repeat. Uses `requestAnimationFrame` so the
 * timing keeps up with the display's actual refresh rate. Degrades
 * gracefully when content fits the container (no transform applied).
 *
 * Speed is intentionally slow — a sauna display should feel like it's
 * breathing, not auctioneering. Tune via the props if a particular slot
 * needs a different cadence.
 */
interface AutoScrollProps {
  children: ReactNode;
  /** Scroll direction. Defaults to vertical (`'y'`). */
  axis?: 'x' | 'y';
  /** Speed in pixels per second. Keep in 8–24 for legibility. */
  speedPxPerSec?: number;
  /** Delay before the first scroll starts, in ms. */
  startDelayMs?: number;
  /** Pause at each end of the cycle, in ms. */
  pauseMs?: number;
  className?: string;
}

export function AutoScroll({
  children,
  axis = 'y',
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
      const max = axis === 'x'
        ? Math.max(0, content.scrollWidth - container.clientWidth)
        : Math.max(0, content.scrollHeight - container.clientHeight);
      if (max === cachedMax) return;
      cachedMax = max;
      if (max === 0) {
        cachedCycleMs = 0;
        content.style.transform = 'translate3d(0,0,0)';
        return;
      }
      const scrollMs = (max / Math.max(4, speedPxPerSec)) * 1000;
      cachedCycleMs = scrollMs * 2 + pauseMs * 2;
      cycleStart = performance.now() + startDelayMs;
    };

    const applyTransform = (offset: number) => {
      content.style.transform = axis === 'x'
        ? `translate3d(${-offset}px,0,0)`
        : `translate3d(0,${-offset}px,0)`;
    };

    const tick = () => {
      const now = performance.now();
      if (cachedCycleMs === 0 || now < cycleStart) {
        applyTransform(0);
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

      applyTransform(offset);
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
  }, [axis, speedPxPerSec, startDelayMs, pauseMs]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'hidden', position: 'relative' }}
    >
      <div
        ref={contentRef}
        style={{
          willChange: 'transform',
          transform: 'translate3d(0,0,0)',
          display: axis === 'x' ? 'inline-block' : 'block',
          minWidth: axis === 'x' ? 'max-content' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
