import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { ENV_IS_DEV } from '@/config/env';
import { displayDevicesApi } from '@/services/displayApi';

const SLIDE_SNAPSHOT_MIN_INTERVAL_MS = 30_000;

/** Wartet auf einen idle-Slot des Browsers (oder nach max `timeoutMs`).
 *  `requestIdleCallback` ist nicht in allen Engines verfügbar (Safari) —
 *  Fallback ist ein simpler `setTimeout`, das ist auf einem Display-
 *  Client immer noch besser als blockierender sofortiger Render. */
function whenIdle(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: timeoutMs });
    } else {
      window.setTimeout(resolve, Math.min(timeoutMs, 1500));
    }
  });
}

interface UseDisplaySnapshotCaptureOptions {
  canCaptureSnapshots: boolean;
  currentSlideIndex: number;
  deviceId: string | null;
  deviceToken: string | null;
  displayRootRef: RefObject<HTMLDivElement | null>;
  layoutKey: string;
  snapshotBackgroundColor: string;
}

export function useDisplaySnapshotCapture({
  canCaptureSnapshots,
  currentSlideIndex,
  deviceId,
  deviceToken,
  displayRootRef,
  layoutKey,
  snapshotBackgroundColor,
}: UseDisplaySnapshotCaptureOptions): void {
  const snapshotUploadInFlightRef = useRef(false);
  const lastSnapshotAtRef = useRef(0);

  const captureLiveSnapshot = useCallback(async (options?: { force?: boolean }) => {
    if (!canCaptureSnapshots || !deviceId || !deviceToken) return;
    if (document.hidden) return;
    if (!options?.force && Date.now() - lastSnapshotAtRef.current < SLIDE_SNAPSHOT_MIN_INTERVAL_MS) {
      return;
    }

    const snapshotTarget = displayRootRef.current || document.body;
    if (!snapshotTarget || snapshotUploadInFlightRef.current) return;

    snapshotUploadInFlightRef.current = true;

    try {
      if ('fonts' in document) {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      }
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      // Auf einem Raspberry Pi blockiert `toJpeg` den Main-Thread
      // 200-800 ms — wenn das mit einer laufenden Slide-Transition
      // kollidiert, gibt es einen sichtbaren Frame-Freeze. Wir warten
      // bis zu 2 s auf einen idle-Slot, bevor wir den schweren Render
      // starten. Im worst case (kein Idle in 2s) machen wir trotzdem
      // weiter — der Snapshot ist nicht so wichtig, dass er beliebig
      // verschoben werden dürfte.
      await whenIdle(2_000);

      const snapshotOptions = {
        backgroundColor: snapshotBackgroundColor,
        cacheBust: true,
        pixelRatio: 0.5,
        quality: 0.6,
        skipFonts: false,
        fetchRequestInit: {
          cache: 'no-store' as RequestCache,
          credentials: 'include' as RequestCredentials,
        },
        filter: (element: HTMLElement) =>
          (element as HTMLElement | undefined)?.dataset?.snapshotIgnore !== 'true',
      };

      const { toJpeg } = await import('html-to-image');

      let imageDataUrl: string;
      try {
        imageDataUrl = await toJpeg(snapshotTarget, snapshotOptions);
      } catch (error) {
        if (ENV_IS_DEV) console.warn('[Display] Snapshot render failed, retrying with reduced options:', error);
        imageDataUrl = await toJpeg(snapshotTarget, {
          ...snapshotOptions,
          pixelRatio: 0.35,
          quality: 0.45,
          skipFonts: true,
        });
      }
      await displayDevicesApi.uploadSnapshot(deviceId, imageDataUrl, deviceToken);
      lastSnapshotAtRef.current = Date.now();
    } catch (error) {
      if (ENV_IS_DEV) console.warn('[Display] Snapshot capture failed:', error);
    } finally {
      snapshotUploadInFlightRef.current = false;
    }
  }, [
    canCaptureSnapshots,
    deviceId,
    deviceToken,
    displayRootRef,
    snapshotBackgroundColor,
  ]);

  useEffect(() => {
    if (!canCaptureSnapshots || !deviceId) return;

    const initialTimer = window.setTimeout(() => {
      if (!snapshotUploadInFlightRef.current) void captureLiveSnapshot({ force: true });
    }, 5000);

    const interval = window.setInterval(() => {
      if (!snapshotUploadInFlightRef.current) void captureLiveSnapshot({ force: true });
    }, 90_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [canCaptureSnapshots, captureLiveSnapshot, deviceId]);

  useEffect(() => {
    if (!canCaptureSnapshots || !deviceId) return;

    // Slide-Wechsel-Snapshot: 5 s statt 2.5 s warten, damit die
    // Transition (typisch 0.6-1.0 s) sicher abgeschlossen ist und
    // nachfolgende Asset-Loads (Resilient-Image-Fallbacks etc.) Zeit
    // hatten zu landen. Der `whenIdle`-Gate im Capture selbst sorgt
    // zusätzlich dafür, dass wir den Browser nicht kalt unterbrechen.
    const timer = window.setTimeout(() => {
      if (!snapshotUploadInFlightRef.current) void captureLiveSnapshot();
    }, 5_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canCaptureSnapshots, captureLiveSnapshot, currentSlideIndex, deviceId, layoutKey]);
}
