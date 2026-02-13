import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Schedule } from '@/types/schedule.types';
import type { Settings } from '@/types/settings.types';
import {
  PREVIEW_CONFIG_EVENT,
  PREVIEW_READY_EVENT,
  PREVIEW_REQUEST_READY_EVENT,
} from './previewBridge';

interface DisplayLivePreviewProps {
  schedule: Schedule;
  settings: Settings;
  src?: string;
  title?: string;
  aspectRatio?: string;
  className?: string;
}

export function DisplayLivePreview({
  schedule,
  settings,
  src = '/display?preview=1',
  title = 'Display Vorschau',
  aspectRatio = '16 / 9',
  className = '',
}: DisplayLivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  const payload = useMemo(() => ({ schedule, settings }), [schedule, settings]);

  const postToFrame = useCallback((message: unknown) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(message, window.location.origin);
  }, []);

  const requestReady = useCallback(() => {
    postToFrame({ type: PREVIEW_REQUEST_READY_EVENT });
  }, [postToFrame]);

  useEffect(() => {
    const handleReady = (event: MessageEvent<{ type?: string }>) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== PREVIEW_READY_EVENT) return;
      setIsReady(true);
    };

    window.addEventListener('message', handleReady);
    return () => {
      window.removeEventListener('message', handleReady);
    };
  }, []);

  useEffect(() => {
    if (isReady) return;
    requestReady();
    const timer = window.setInterval(requestReady, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [isReady, requestReady]);

  useEffect(() => {
    if (!isReady) return;
    postToFrame({
      type: PREVIEW_CONFIG_EVENT,
      payload,
    });
  }, [isReady, payload, postToFrame]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-spa-bg-secondary bg-black ${className}`}
      style={{ aspectRatio }}
    >
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        allow="autoplay"
        className="absolute inset-0 h-full w-full border-0"
        onLoad={() => {
          setIsReady(false);
          // Trigger immediately and shortly after load to catch early/late listeners reliably.
          requestReady();
          window.setTimeout(requestReady, 120);
        }}
      />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/65 text-white">
          <div className="text-center text-sm font-medium">Vorschau wird initialisiert...</div>
        </div>
      )}
    </div>
  );
}
