import clsx from 'clsx';

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card';

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  /** Number of text lines to render (only for variant="text") */
  lines?: number;
}

const shimmerClass =
  'animate-pulse bg-gradient-to-r from-spa-bg-secondary via-spa-bg-primary to-spa-bg-secondary bg-[length:200%_100%]';

const variantDefaults: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded',
  circle: 'h-10 w-10 rounded-full',
  rect: 'h-24 w-full rounded-lg',
  card: 'h-40 w-full rounded-xl border border-spa-bg-secondary/50',
};

export function Skeleton({ variant = 'rect', className, lines }: SkeletonProps) {
  if (variant === 'text' && lines && lines > 1) {
    return (
      <div className={clsx('space-y-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={clsx(
              shimmerClass,
              'h-4 rounded',
              i === lines - 1 && 'w-3/4',
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(shimmerClass, variantDefaults[variant], className)}
      aria-hidden="true"
    />
  );
}

/** Pre-composed skeleton for a dashboard widget card */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={clsx('rounded-xl border border-spa-bg-secondary/50 bg-white p-6 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="h-8 w-8" />
        <Skeleton variant="text" className="h-5 w-1/3" />
      </div>
      <Skeleton variant="text" lines={3} />
    </div>
  );
}

/** Pre-composed skeleton for a table row */
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-spa-bg-secondary/30">
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={clsx('h-4', i === 0 ? 'w-1/4' : 'w-1/6')}
        />
      ))}
    </div>
  );
}

/** Pre-composed skeleton for a media grid item */
export function SkeletonMediaCard() {
  return (
    <div className="rounded-xl border border-spa-bg-secondary/50 bg-white overflow-hidden">
      <Skeleton variant="rect" className="h-32 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton variant="text" className="h-4 w-2/3" />
        <Skeleton variant="text" className="h-3 w-1/3" />
      </div>
    </div>
  );
}
