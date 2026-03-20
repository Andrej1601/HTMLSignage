import { useEffect, useState } from 'react';
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';

interface SlideProgressIndicatorProps {
  durationSec: number;
  startColor: string;
  endColor: string;
  surfaceColor: string;
  borderColor: string;
  className?: string;
  compact?: boolean;
}

function AnimatedProgressFill({
  durationSec,
  endColor,
  startColor,
}: {
  durationSec: number;
  endColor: string;
  startColor: string;
}) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsActive(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className="h-full origin-left rounded-full"
      style={{
        background: `linear-gradient(to right, ${startColor}, ${endColor})`,
        transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
        transition: `transform ${durationSec}s linear`,
        willChange: 'transform',
      }}
    />
  );
}

export function SlideProgressIndicator({
  durationSec,
  startColor,
  endColor,
  surfaceColor,
  borderColor,
  className,
  compact = false,
}: SlideProgressIndicatorProps) {
  return (
    <div
      className={classNames(
        'pointer-events-none rounded-full border backdrop-blur-xl',
        compact ? 'px-2 py-1.5' : 'px-2.5 py-2',
        className,
      )}
      style={{
        backgroundColor: withAlpha(surfaceColor, 0.56),
        borderColor: withAlpha(borderColor, 0.18),
        boxShadow: `0 6px 18px ${withAlpha('#000000', 0.08)}`,
      }}
      aria-hidden="true"
    >
      <div
        className={classNames('overflow-hidden rounded-full', compact ? 'h-0.5 w-12' : 'h-1 w-16')}
        style={{ backgroundColor: withAlpha(borderColor, 0.16) }}
      >
        <AnimatedProgressFill
          durationSec={durationSec}
          startColor={startColor}
          endColor={endColor}
        />
      </div>
    </div>
  );
}
