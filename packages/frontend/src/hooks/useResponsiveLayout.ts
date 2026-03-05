import { useEffect, useRef, useState } from 'react';

/**
 * Hook for responsive layout detection via ResizeObserver.
 * Returns a ref to attach to the container and a boolean indicating compact mode.
 */
export function useCompactDetector(threshold = 250) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => setCompact(el.clientHeight < threshold);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [threshold]);

  return { containerRef, compact };
}

/**
 * Hook for responsive layout detection with multiple breakpoints.
 * Returns a ref and a layout string based on container dimensions.
 */
export function useResponsiveLayout() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<'compact' | 'vertical' | 'horizontal'>('horizontal');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const h = el.clientHeight;
      const w = el.clientWidth;
      if (h < 250) setLayout('compact');
      else if (h > w * 0.8) setLayout('vertical');
      else setLayout('horizontal');
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { containerRef, layout };
}
