import { useEffect, useMemo, useRef, useState } from 'react';

export interface DisplayViewportProfile {
  width: number;
  height: number;
  isPortrait: boolean;
  isNarrow: boolean;
  isShort: boolean;
  isCompact: boolean;
  isUltraCompact: boolean;
}

function buildProfile(width: number, height: number): DisplayViewportProfile {
  const safeWidth = Math.max(0, Math.round(width));
  const safeHeight = Math.max(0, Math.round(height));
  const isPortrait = safeHeight > safeWidth * 1.02;
  const isNarrow = safeWidth > 0 && safeWidth < 760;
  const isShort = safeHeight > 0 && safeHeight < 520;
  const isCompact = (safeWidth > 0 && safeWidth < 980) || (safeHeight > 0 && safeHeight < 680);
  const isUltraCompact = (safeWidth > 0 && safeWidth < 620) || (safeHeight > 0 && safeHeight < 440);

  return {
    width: safeWidth,
    height: safeHeight,
    isPortrait,
    isNarrow,
    isShort,
    isCompact,
    isUltraCompact,
  };
}

export function useDisplayViewportProfile<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const update = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();
    const frame = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(element);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  const profile = useMemo(
    () => buildProfile(size.width, size.height),
    [size.height, size.width],
  );

  return { containerRef, profile };
}
