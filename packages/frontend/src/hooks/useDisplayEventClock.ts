import { useEffect, useState } from 'react';

/**
 * Provides a clock value (epoch ms) that updates every 30 seconds.
 * In preview mode with a clock override, uses the fixed override value.
 */
export function useDisplayEventClock(previewClockOverride: number | null): number {
  const [eventClock, setEventClock] = useState(() => previewClockOverride ?? Date.now());

  // Sync clock to preview override during render (avoid effect setState)
  const [prevOverride, setPrevOverride] = useState(previewClockOverride);
  if (prevOverride !== previewClockOverride) {
    setPrevOverride(previewClockOverride);
    if (previewClockOverride !== null) {
      setEventClock(previewClockOverride);
    }
  }

  useEffect(() => {
    if (previewClockOverride !== null) return;

    const interval = window.setInterval(() => {
      setEventClock((prev) => {
        const now = Date.now();
        return Math.floor(now / 60_000) !== Math.floor(prev / 60_000) ? now : prev;
      });
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [previewClockOverride]);

  return eventClock;
}
