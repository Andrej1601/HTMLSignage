import type { ImgHTMLAttributes, ReactNode } from 'react';
import { useResilientMediaSource } from '@/hooks/useResilientMediaSource';

interface ResilientImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  fallback?: ReactNode;
}

export function ResilientImage({
  src,
  fallback = null,
  onError,
  ...props
}: ResilientImageProps) {
  const { resolvedSrc, hasFailed, handleError } = useResilientMediaSource(src);

  if (hasFailed && fallback) {
    return <>{fallback}</>;
  }

  if (!resolvedSrc) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      {...props}
      src={resolvedSrc}
      crossOrigin={props.crossOrigin ?? 'anonymous'}
      onError={(event) => {
        onError?.(event);
        void handleError();
      }}
    />
  );
}
