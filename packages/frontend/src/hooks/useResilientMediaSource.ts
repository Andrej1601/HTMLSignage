import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveCachedDisplayAssetUrl } from '@/utils/displayAssetCache';

interface ResilientMediaSourceState {
  resolvedSrc: string;
  hasFailed: boolean;
  isUsingFallback: boolean;
  handleError: () => Promise<void>;
}

export function useResilientMediaSource(src?: string | null): ResilientMediaSourceState {
  const fallbackUrlRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const [resolvedSrc, setResolvedSrc] = useState(src || '');
  const [hasFailed, setHasFailed] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const cleanupFallbackUrl = useCallback(() => {
    if (fallbackUrlRef.current) {
      URL.revokeObjectURL(fallbackUrlRef.current);
      fallbackUrlRef.current = null;
    }
  }, []);

  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setResolvedSrc(src || '');
    setHasFailed(false);
    setIsUsingFallback(false);
  }

  useEffect(() => {
    attemptRef.current += 1;
    cleanupFallbackUrl();
    return cleanupFallbackUrl;
  }, [src, cleanupFallbackUrl]);

  const handleError = useCallback(async () => {
    if (!src) {
      setHasFailed(true);
      return;
    }

    if (isUsingFallback) {
      setHasFailed(true);
      return;
    }

    const attemptId = attemptRef.current;
    const fallbackUrl = await resolveCachedDisplayAssetUrl(src).catch(() => null);

    if (attemptId !== attemptRef.current) {
      if (fallbackUrl) {
        URL.revokeObjectURL(fallbackUrl);
      }
      return;
    }

    if (!fallbackUrl) {
      setHasFailed(true);
      return;
    }

    cleanupFallbackUrl();
    fallbackUrlRef.current = fallbackUrl;
    setResolvedSrc(fallbackUrl);
    setHasFailed(false);
    setIsUsingFallback(true);
  }, [cleanupFallbackUrl, isUsingFallback, src]);

  return {
    resolvedSrc,
    hasFailed,
    isUsingFallback,
    handleError,
  };
}
