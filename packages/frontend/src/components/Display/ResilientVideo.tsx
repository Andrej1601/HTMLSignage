import type { ReactNode, VideoHTMLAttributes } from 'react';
import { useResilientMediaSource } from '@/hooks/useResilientMediaSource';

interface ResilientVideoProps extends Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> {
  src?: string | null;
  fallback?: ReactNode;
}

export function ResilientVideo({
  src,
  fallback = null,
  onError,
  children,
  ...props
}: ResilientVideoProps) {
  const { resolvedSrc, hasFailed, handleError } = useResilientMediaSource(src);

  if (hasFailed && fallback) {
    return <>{fallback}</>;
  }

  if (!resolvedSrc) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <video
      {...props}
      src={resolvedSrc}
      crossOrigin={props.crossOrigin ?? 'anonymous'}
      onError={(event) => {
        onError?.(event);
        void handleError();
      }}
    >
      {children}
    </video>
  );
}
