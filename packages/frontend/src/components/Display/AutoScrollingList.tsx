import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import type { InfusionStatus } from './wellnessDisplayUtils';
import { getInfusionStatus } from './wellnessDisplayUtils';

const SCROLL_SPEED_PX_PER_SEC = 22;
const START_DELAY_MS = 3000;
const LOOP_PAUSE_MS = 900;

export interface InfusionListItem {
  id: string;
  time: string; // HH:MM
  duration: number; // minutes
}

export interface AutoScrollingListItemProps<T extends InfusionListItem> {
  infusion: T;
  status: InfusionStatus;
}

interface AutoScrollingListProps<T extends InfusionListItem> {
  items: T[];
  itemComponent: (props: AutoScrollingListItemProps<T>) => React.ReactNode;
  now: Date;
  isDetail?: boolean;
  prestartMinutes?: number;
}

export function AutoScrollingList<T extends InfusionListItem>({
  items,
  itemComponent: ItemComponent,
  now,
  prestartMinutes = 10,
}: AutoScrollingListProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [shouldScroll, setShouldScroll] = useState(false);
  const normalizedPrestartMinutes = Number.isFinite(prestartMinutes)
    ? Math.min(120, Math.max(0, Math.round(prestartMinutes)))
    : 10;

  // Use a primitive signature so re-renders with identical content don't restart the scroll animation.
  const itemsSignature = useMemo(
    () => items.map((i) => `${i.id}:${i.time}:${i.duration}`).join('|'),
    [items]
  );

  // Detect overflow dynamically via ResizeObserver
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const check = () => {
      setShouldScroll(content.scrollHeight > viewport.clientHeight + 4);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(viewport);
    ro.observe(content);
    return () => ro.disconnect();
  }, [itemsSignature]);

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    // Always reset to top when items or scroll mode changes.
    controls.stop();
    controls.set({ y: 0 });

    const run = async () => {
      if (!shouldScroll) return;

      await sleep(START_DELAY_MS);
      if (cancelled) return;

      while (!cancelled) {
        const viewport = viewportRef.current;
        const content = contentRef.current;
        if (!viewport || !content) return;

        const maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
        if (maxScroll <= 0) return;

        const durationSec = maxScroll / SCROLL_SPEED_PX_PER_SEC;
        try {
          await controls.start({
            y: -maxScroll,
            transition: {
              duration: durationSec,
              ease: 'linear',
            },
          });
        } catch {
          // Animation interrupted (e.g. unmount); just exit.
          return;
        }

        if (cancelled) return;
        await sleep(LOOP_PAUSE_MS);
        if (cancelled) return;
        // Jump back to the top (no seamless wrap).
        controls.set({ y: 0 });
        await sleep(START_DELAY_MS);
        if (cancelled) return;
      }
    };

    run();

    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [controls, itemsSignature, shouldScroll]);

  return (
    <div ref={viewportRef} className="relative flex-1 h-full min-h-0 overflow-hidden">
      <motion.div animate={controls} ref={contentRef} initial={{ y: 0 }}>
        {items.map((item) => {
          const status = getInfusionStatus(now, item.time, item.duration, normalizedPrestartMinutes);
          return <ItemComponent key={item.id} infusion={item} status={status} />;
        })}
      </motion.div>
      {shouldScroll && (
        <>
          <div className="absolute top-0 left-0 right-0 h-8 bg-linear-to-b from-inherit to-transparent z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-inherit to-transparent z-10 pointer-events-none" />
        </>
      )}
    </div>
  );
}
