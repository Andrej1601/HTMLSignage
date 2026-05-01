import { useEffect, useState } from 'react';
import { classNames } from '@/utils/classNames';
import { withAlpha } from '@/components/Display/wellnessDisplayUtils';

interface SlideProgressIndicatorProps {
  /** Slide duration in seconds. */
  durationSec: number;
  /** Accent colour for the progress fill. */
  color: string;
  /** Where to anchor the bar inside the parent. Default: bottom. */
  position?: 'top' | 'bottom';
  /** Track thickness in px. Default: 3 (vorher 1.5 — aus 3–5 m
   *  Distanz im Spa war der dünnere Strich nicht erkennbar). */
  thicknessPx?: number;
  /** Opacity of the filled portion (0–1). Default: 0.6 (vorher 0.35 —
   *  reicht aus Distanz spürbar besser, ohne den Slide zu überlagern). */
  fillOpacity?: number;
  className?: string;
}

/**
 * Dezenter Slide-Progress-Indikator.
 *
 * Rendert eine dünne, volle-Breite Linie am oberen oder unteren Rand
 * seines Containers. Der Füllanteil wächst linear von 0 % auf 100 %
 * über `durationSec`. Nutzt eine CSS-Transform-Animation — keine
 * weiteren Abhängigkeiten.
 *
 * Im Gegensatz zur vorherigen Pille wird der Indikator auf Zone-Ebene
 * eingehängt (volle Breite, minimal hoch) und fällt so optisch zurück,
 * bleibt aber jederzeit sichtbar.
 */
export function SlideProgressIndicator({
  durationSec,
  color,
  position = 'bottom',
  thicknessPx = 3,
  fillOpacity = 0.6,
  className,
}: SlideProgressIndicatorProps) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsActive(true);
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const safeDuration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 12;
  const clampedFill = Math.max(0, Math.min(1, fillOpacity));

  return (
    <div
      aria-hidden="true"
      className={classNames(
        'pointer-events-none absolute left-0 right-0 z-20 overflow-hidden',
        position === 'top' ? 'top-0' : 'bottom-0',
        className,
      )}
      style={{
        height: `${thicknessPx}px`,
        backgroundColor: withAlpha(color, 0.12),
      }}
    >
      <div
        className="h-full origin-left"
        style={{
          backgroundColor: withAlpha(color, clampedFill),
          transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
          transition: `transform ${safeDuration}s linear`,
          willChange: 'transform',
        }}
      />
    </div>
  );
}
