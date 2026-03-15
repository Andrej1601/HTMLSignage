import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { displayDevicesApi } from '@/services/displayApi';

const SLIDE_SNAPSHOT_MIN_INTERVAL_MS = 30_000;

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
        console.warn('[Display] Snapshot render failed, retrying with reduced options:', error);
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
      console.warn('[Display] Snapshot capture failed:', error);
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
      void captureLiveSnapshot({ force: true });
    }, 5000);

    const interval = window.setInterval(() => {
      void captureLiveSnapshot({ force: true });
    }, 90_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [canCaptureSnapshots, captureLiveSnapshot, deviceId]);

  useEffect(() => {
    if (!canCaptureSnapshots || !deviceId) return;

    const timer = window.setTimeout(() => {
      void captureLiveSnapshot();
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canCaptureSnapshots, captureLiveSnapshot, currentSlideIndex, deviceId, layoutKey]);
}
